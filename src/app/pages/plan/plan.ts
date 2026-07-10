import { Component, type OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type { BriefingResponse, PlanTripResponse } from '@road-travel/sdk';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { EntitlementService } from '../../core/entitlement.service';
import { AccountRequiredError, PaywallError } from '../../core/errors';
import { PaywallService } from '../../core/paywall.service';
import { SettingsService } from '../../core/settings.service';
import { TripsService } from '../../core/trips.service';
import { AheadBanner } from './ahead-banner';
import { BriefingCard } from './briefing-card';
import { PlaceField, type PlaceValue } from './place-field';
import { RouteMap } from './route-map';
import { type Severity } from './severity';
import { Timeline } from './timeline';

/**
 * The planning experience, mirroring the iOS app: an inputs card with two place-search fields (no
 * coordinates), a departure + units row, then the results — map, space-time timeline, and briefing.
 * Thin client: the backend routes/samples/briefs (ADR-0011).
 */
@Component({
  selector: 'app-plan',
  imports: [FormsModule, RouterLink, PlaceField, RouteMap, Timeline, BriefingCard, AheadBanner],
  template: `
    <div class="page">
      <header class="top">
        <h1>Plan a drive</h1>
        <div class="actions">
          @if (plan()) {
            <button
              class="icon"
              [class.on]="isCurrentSaved()"
              (click)="saveTrip()"
              [attr.aria-label]="isCurrentSaved() ? 'Remove from saved' : 'Save trip'"
              title="Save trip"
            >
              {{ isCurrentSaved() ? '★' : '☆' }}
            </button>
          }
          @if (!auth.configured() || auth.hasRealAccount()) {
            <!-- ADR-0025 §1: Recent / Saved are LOGIN-ONLY — hidden from guests (their routes are
                 walled by realAccountGuard). Identity, Settings, and sign-in/out live ONLY in the
                 app header, so this toolbar stays plan-specific with no duplicate affordances. -->
            <div class="menu-wrap">
              <button
                class="icon"
                [class.on]="recentsOpen()"
                (click)="recentsOpen.set(!recentsOpen())"
                [disabled]="!trips.recents().length"
                aria-label="Recent trips"
                title="Recent trips"
              >
                🕘
              </button>
              @if (recentsOpen() && trips.recents().length) {
                <ul class="menu" role="menu">
                  @for (r of trips.recents(); track r.at) {
                    <li role="menuitem" (click)="useRecent(r)">
                      {{ short(r.origin.name) }} → {{ short(r.destination.name) }}
                    </li>
                  }
                </ul>
              }
            </div>
            <a class="icon" routerLink="/saved" aria-label="My trips" title="My trips">🔖</a>
          }
        </div>
      </header>

      <div class="inputs card">
        <app-place-field
          kind="origin"
          placeholder="Origin"
          [place]="origin()"
          (placeChange)="origin.set($event)"
        />
        <div class="divider">
          <button class="swap" type="button" (click)="swap()" aria-label="Swap origin and destination">⇅</button>
        </div>
        <app-place-field
          kind="destination"
          placeholder="Destination"
          [place]="destination()"
          (placeChange)="destination.set($event)"
        />
      </div>

      @if (settings.home() || settings.work()) {
        <div class="favs">
          <span class="favs-label">Go to</span>
          @if (settings.home(); as h) {
            <button class="chip" (click)="useFavorite(h)" title="Set destination to Home">🏠 Home</button>
          }
          @if (settings.work(); as w) {
            <button class="chip" (click)="useFavorite(w)" title="Set destination to Work">💼 Work</button>
          }
        </div>
      }

      <div class="controls card">
        <label class="ctl">
          <span>Departure</span>
          <input type="datetime-local" [(ngModel)]="departureAt" name="departureAt" />
        </label>
        <label class="ctl">
          <span>Units</span>
          <select [ngModel]="settings.units()" (ngModelChange)="settings.setUnits($event)" name="units">
            <option value="imperial">mi / °F</option>
            <option value="metric">km / °C</option>
          </select>
        </label>
        <button class="go" (click)="submit()" [disabled]="loading() || !canSubmit()">
          {{ loading() ? 'Planning…' : 'Get briefing' }}
        </button>
      </div>

      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }

      @if (plan(); as p) {
        <app-ahead-banner [plan]="p" [units]="settings.units()" />
        <app-route-map
          [plan]="p"
          [selected]="selected()"
          (selectedChange)="selected.set($event)"
        />
        <div class="scrubber card">
          <div class="scrub-head">
            <span>Departure</span>
            <strong>{{ shiftedLabel() }}</strong>
            @if (replanning()) {
              <span class="rescan">re-checking…</span>
            }
          </div>
          <input
            type="range"
            min="0"
            max="180"
            step="5"
            [value]="departureOffset()"
            (input)="onScrub($event)"
            aria-label="Shift departure time"
          />
          <div class="scrub-ticks"><span>now</span><span>+3h</span></div>
        </div>
        <h3 class="section">Along the way</h3>
        <app-timeline
          [plan]="p"
          [units]="settings.units()"
          [selected]="selected()"
          (selectedChange)="selected.set($event)"
        />
      }
      @if (briefing(); as b) {
        <app-briefing-card [briefing]="b" [units]="settings.units()" />
      }
    </div>
  `,
  styles: [
    `
      .page {
        max-width: 720px;
        margin: 0 auto;
        padding: 18px 16px 64px;
      }
      .top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 14px;
      }
      h1 {
        font-size: 22px;
        margin: 0;
      }
      .actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .icon {
        width: 36px;
        height: 36px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        border: 1px solid var(--border);
        background: var(--surface);
        color: var(--text);
        font-size: 16px;
        cursor: pointer;
        text-decoration: none;
        padding: 0;
      }
      .icon:hover {
        border-color: var(--accent);
        text-decoration: none;
      }
      .icon.on {
        background: var(--accent);
        border-color: var(--accent);
        color: var(--accent-contrast);
      }
      .icon:disabled {
        opacity: 0.45;
        cursor: default;
      }
      .menu-wrap {
        position: relative;
      }
      .menu {
        position: absolute;
        right: 0;
        top: calc(100% + 6px);
        z-index: 30;
        list-style: none;
        margin: 0;
        padding: 4px;
        min-width: 220px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.18);
      }
      .menu li {
        padding: 9px 10px;
        border-radius: 8px;
        font-size: 14px;
        cursor: pointer;
        white-space: nowrap;
      }
      .menu li:hover {
        background: var(--surface-2);
      }
      .link {
        background: none;
        border: none;
        color: var(--accent);
        cursor: pointer;
        padding: 0;
        font-size: 13px;
      }
      .card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
      }
      .inputs {
        position: relative;
      }
      .favs {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 10px;
      }
      .favs-label {
        font-size: 12px;
        color: var(--muted);
      }
      .chip {
        border: 1px solid var(--border);
        background: var(--surface);
        color: var(--text);
        font: inherit;
        font-size: 13px;
        padding: 6px 12px;
        border-radius: 999px;
        cursor: pointer;
      }
      .chip:hover {
        border-color: var(--accent);
      }
      .divider {
        position: relative;
        height: 1px;
        background: var(--border);
        margin-left: 34px;
      }
      .swap {
        position: absolute;
        right: 10px;
        top: -15px;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 1px solid var(--border);
        background: var(--surface);
        color: var(--muted);
        cursor: pointer;
        font-size: 14px;
      }
      .controls {
        display: flex;
        align-items: end;
        gap: 12px;
        margin-top: 12px;
        padding: 12px;
        flex-wrap: wrap;
      }
      .ctl {
        display: grid;
        gap: 4px;
        font-size: 12px;
        color: var(--muted);
      }
      .ctl input,
      .ctl select {
        padding: 8px 10px;
        border: 1px solid var(--border);
        border-radius: 10px;
        font: inherit;
        background: var(--surface);
        color: var(--text);
      }
      .go {
        margin-left: auto;
        background: var(--accent);
        color: var(--accent-contrast);
        border: none;
        border-radius: 10px;
        padding: 11px 20px;
        font-weight: 600;
        cursor: pointer;
      }
      .go:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .error {
        background: color-mix(in srgb, var(--sev-severe) 12%, var(--surface));
        border: 1px solid color-mix(in srgb, var(--sev-severe) 40%, var(--surface));
        color: var(--sev-severe);
        padding: 10px 12px;
        border-radius: 10px;
        margin: 14px 0;
      }
      .section {
        font-size: 14px;
        margin: 18px 0 8px;
      }
      app-ahead-banner,
      app-route-map,
      app-timeline,
      app-briefing-card {
        display: block;
        margin-top: 16px;
      }
      .scrubber {
        margin-top: 12px;
        padding: 12px 14px;
      }
      .scrub-head {
        display: flex;
        align-items: baseline;
        gap: 8px;
        font-size: 12px;
        color: var(--muted);
        margin-bottom: 6px;
      }
      .scrub-head strong {
        color: var(--text);
        font-size: 14px;
        font-variant-numeric: tabular-nums;
      }
      .rescan {
        margin-left: auto;
        color: var(--accent);
      }
      .scrubber input[type='range'] {
        width: 100%;
        accent-color: var(--accent);
      }
      .scrub-ticks {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: var(--muted);
        margin-top: 2px;
      }
    `,
  ],
})
export class Plan implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  readonly settings = inject(SettingsService);
  readonly trips = inject(TripsService);
  readonly entitlement = inject(EntitlementService);
  private readonly paywall = inject(PaywallService);
  private readonly router = inject(Router);

  readonly origin = signal<PlaceValue | null>({
    name: 'San Francisco, CA',
    latitude: 37.7749,
    longitude: -122.4194,
  });
  readonly destination = signal<PlaceValue | null>({
    name: 'Los Angeles, CA',
    latitude: 34.0522,
    longitude: -118.2437,
  });

  departureAt = this.defaultDeparture();
  readonly recentsOpen = signal(false);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly plan = signal<PlanTripResponse | null>(null);
  readonly briefing = signal<BriefingResponse | null>(null);
  /** Selected route-sample index, shared between the map and the timeline. */
  readonly selected = signal<number | null>(null);

  // Departure scrubber: nudge the planned departure forward and re-fetch the route weather (mirrors
  // the iOS result-screen scrubber). The briefing text stays as first generated.
  readonly departureOffset = signal(0); // minutes past the planned departure
  readonly replanning = signal(false);
  private readonly plannedBase = signal<Date | null>(null);
  private plannedContext: { origin: PlaceValue; destination: PlaceValue } | null = null;
  private scrubTimer: ReturnType<typeof setTimeout> | undefined;

  readonly canSubmit = computed(() => !!this.origin() && !!this.destination());

  /** Whether the currently-shown trip is in the saved list (reacts to saves + endpoint changes). */
  readonly isCurrentSaved = computed(() => {
    const o = this.origin();
    const d = this.destination();
    return !!o && !!d && this.trips.isSaved(o, d);
  });

  ngOnInit(): void {
    // Know the entitlement/usage up front so gating is correct (server-authoritative; F-002).
    void this.entitlement.refresh();
    // A trip queued from Recents/Saved: prefill the fields and plan it immediately.
    const staged = this.trips.takeStaged();
    if (!staged) return;
    this.origin.set(staged.origin);
    this.destination.set(staged.destination);
    if (staged.departureAt) this.departureAt = this.toLocalInput(new Date(staged.departureAt));
    void this.submit();
  }

  useRecent(trip: { origin: PlaceValue; destination: PlaceValue }): void {
    this.origin.set(trip.origin);
    this.destination.set(trip.destination);
    this.recentsOpen.set(false);
    void this.submit();
  }

  /** Fill the destination with a favorite place (Home/Work). Origin keeps whatever the user set. */
  useFavorite(place: PlaceValue): void {
    this.destination.set(place);
  }

  saveTrip(): void {
    const origin = this.origin();
    const destination = this.destination();
    if (!origin || !destination) return;
    const p = this.plan();
    this.trips.toggleSave({
      origin,
      destination,
      departureAt: new Date(this.departureAt).toISOString(),
      distanceMeters: p?.distance_meters,
      worstSeverity: p?.worst_severity as Severity | undefined,
    });
  }

  short(name: string): string {
    return name.split(',')[0];
  }

  readonly shiftedLabel = computed(() => {
    const base = this.plannedBase();
    if (!base) return '';
    const off = this.departureOffset();
    const at = new Date(base.getTime() + off * 60_000);
    const time = at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return off > 0 ? `${time}  (+${off} min)` : time;
  });

  onScrub(event: Event): void {
    this.departureOffset.set(Number((event.target as HTMLInputElement).value));
    clearTimeout(this.scrubTimer);
    this.scrubTimer = setTimeout(() => this.replan(), 300);
  }

  private async replan(): Promise<void> {
    const base = this.plannedBase();
    const ctx = this.plannedContext;
    if (!base || !ctx) return;
    const departure_at = new Date(base.getTime() + this.departureOffset() * 60_000).toISOString();
    this.replanning.set(true);
    try {
      const plan = await this.api.planTrip({ ...ctx, departure_at });
      this.plan.set(plan);
      this.selected.set(null);
    } catch (e) {
      // A re-plan can also hit the entitlement gate; surface the paywall / sign-in, else keep the
      // current plan on a transient failure.
      if (e instanceof AccountRequiredError) this.router.navigate(['/login']);
      else if (e instanceof PaywallError) this.paywall.show(e.payload);
    } finally {
      this.replanning.set(false);
    }
  }

  swap(): void {
    const o = this.origin();
    this.origin.set(this.destination());
    this.destination.set(o);
  }

  private defaultDeparture(): string {
    return this.toLocalInput(new Date(Date.now() + 3_600_000));
  }

  /** Format a Date for a <input type="datetime-local"> value (local time, minute precision). */
  private toLocalInput(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  async submit(): Promise<void> {
    const origin = this.origin();
    const destination = this.destination();
    if (!origin || !destination) return;

    this.error.set(null);
    this.loading.set(true);
    this.plan.set(null);
    this.briefing.set(null);
    this.selected.set(null);
    this.departureOffset.set(0);

    const base = new Date(this.departureAt);
    const departure_at = base.toISOString();
    try {
      const [plan, briefing] = await Promise.all([
        this.api.planTrip({ origin, destination, departure_at }),
        this.api.createBriefing({ origin, destination, departure_at, units: this.settings.units() }),
      ]);
      this.plan.set(plan);
      this.briefing.set(briefing);
      this.plannedContext = { origin, destination };
      this.plannedBase.set(base);
      this.trips.addRecent(origin, destination);
    } catch (e) {
      if (e instanceof AccountRequiredError) {
        // ADR-0025 auth wall: Show Weather requires a signed-in account -> go to the sign-in page.
        this.router.navigate(['/login']);
      } else if (e instanceof PaywallError) {
        // Signed in but not entitled -> show the server's store-trial paywall, not a generic error.
        this.paywall.show(e.payload);
      } else {
        this.error.set(this.describe(e));
      }
    } finally {
      this.loading.set(false);
    }
  }

  private describe(e: unknown): string {
    const status = (e as { response?: { status?: number } })?.response?.status;
    if (status === 401) return 'Please sign in to generate a briefing.';
    if (status === 503) return 'The briefing service is busy right now — please try again shortly.';
    const msg =
      (e as { error?: { message?: string } })?.error?.message ??
      (e as { message?: string })?.message;
    return msg ? `Could not plan the trip: ${msg}` : 'Could not plan the trip. Please try again.';
  }
}
