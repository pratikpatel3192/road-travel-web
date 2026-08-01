import { Component, type OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { BriefingResponse, PlaceCardModel, PlanTripResponse } from '@road-travel/sdk';

import { AnalyticsService } from '../../core/analytics.service';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { EntitlementService } from '../../core/entitlement.service';
import { AccountRequiredError, PaywallError } from '../../core/errors';
import { GeocodeService } from '../../core/geocode.service';
import { PaywallService } from '../../core/paywall.service';
import { SettingsService } from '../../core/settings.service';
import { TripsService } from '../../core/trips.service';
import { AheadBanner } from './ahead-banner';
import { BriefingCard } from './briefing-card';
import { ExplorePanel } from './explore-panel';
import { PlaceField, type PlaceValue } from './place-field';
import { BriefingMemory, tripBaselineKey } from './rebrief';
import { RouteMap } from './route-map';
import { type Severity, formatDuration } from './severity';
import { StopList } from './stop-list';
import { Timeline } from './timeline';
import {
  type DwellMinutes,
  MAX_STOPS,
  type StopDraft,
  buildBriefingRequest,
  buildPlanRequest,
  fromWaypoints,
  newStop,
  toWaypoints,
  waypointsKey,
} from './waypoints';

/**
 * The planning experience, mirroring the iOS app: an inputs card with two place-search fields (no
 * coordinates), a departure + units row, then the results — map, space-time timeline, and briefing.
 * Thin client: the backend routes/samples/briefs (ADR-0011).
 */
@Component({
  selector: 'app-plan',
  imports: [FormsModule, RouterLink, PlaceField, StopList, RouteMap, Timeline, BriefingCard, AheadBanner, ExplorePanel],
  template: `
    <div class="shell">
      <section class="panel">
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
            <!-- ADR-0025 §1: My Trips is LOGIN-ONLY — hidden from guests (the route is walled by
                 realAccountGuard). ADR-0029 removed Recents; Saved is the server's list. -->
            <a class="icon" routerLink="/saved" aria-label="My trips" title="My trips">🔖</a>
          }
        </div>
      </header>

      <div class="inputs card">
        <app-place-field
          kind="origin"
          placeholder="Origin"
          [place]="origin()"
          [near]="destination()"
          (placeChange)="origin.set($event)"
        />
        <div class="divider">
          <button class="swap" type="button" (click)="swap()" aria-label="Swap origin and destination">⇅</button>
        </div>
        <!-- F-006: up to 3 ordered stops between origin and destination; every edit re-plans. -->
        <app-stop-list [stops]="stops()" [near]="stopBias()" (stopsChange)="onStopsChange($event)" />
        <app-place-field
          kind="destination"
          placeholder="Destination"
          [place]="destination()"
          [near]="origin()"
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
        <!-- F-006 trip summary: driving time + total dwell + arrival, all SERVER values
             (arrival_at already includes dwell; duration_seconds stays driving-only). -->
        <div class="summary card">
          <span class="sum-drive">{{ summaryLabel(p) }}</span>
          <span class="sum-arrive">arrive <strong>{{ arriveLabel(p) }}</strong></span>
        </div>
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
        <!-- F-005 Trip Explorer: a Pro surface on the PLANNED trip (gating is the server's 402 →
             the existing paywall modal — never client-decided). -->
        @if (!exploreOpen()) {
          <button class="explore-open card" type="button" (click)="exploreOpen.set(true)">
            <span>🧭 Explore along the way</span>
            <span class="explore-sub">stops · food · fuel · scenic</span>
          </button>
        } @else if (plannedContext(); as ctx) {
          <app-explore-panel
            [origin]="ctx.origin"
            [destination]="ctx.destination"
            [departureAt]="exploreDepartureAt()"
            [waypoints]="exploreWaypoints()"
            [units]="settings.units()"
            [highlighted]="exploreSelected()"
            (close)="closeExplore()"
            (cardsChange)="onExploreCards($event)"
            (highlightChange)="onExploreHighlight($event)"
            (addStop)="onExploreAddStop($event)"
          />
        }
      }
      @if (briefing(); as b) {
        <!-- F-001 v2 US-13: a tapped claim sentence selects its sample on the timeline + map. -->
        <app-briefing-card
          [briefing]="b"
          [units]="settings.units()"
          (claimSelect)="selected.set($event)"
        />
      }
      </section>

      <!-- ADR-0026: the dominant map pane fills the remaining viewport. Always mounted — idle it
           shows the live-location home map; after planning, the severity-colored route. -->
      <aside class="map-pane">
        <app-route-map
          [plan]="plan()"
          [userLocation]="userLocation()"
          [selected]="selected()"
          (selectedChange)="selected.set($event)"
          (stopRequest)="addStopFromMap($event)"
          [explorePins]="exploreCards()"
          [exploreSelected]="exploreSelected()"
          (exploreSelectedChange)="onExploreHighlight($event)"
        />
      </aside>
    </div>
  `,
  styles: [
    `
      /* Full-viewport two-pane shell (ADR-0026 / DESIGN_SYSTEM "fill the viewport"): content
         panel left with its own scroll, dominant map pane filling the rest. Stacks on mobile. */
      .shell {
        display: grid;
        grid-template-columns: minmax(400px, 480px) 1fr;
        height: calc(100dvh - 73px); /* viewport minus the app header */
        min-height: 480px;
      }
      .panel {
        overflow-y: auto;
        padding: 18px 20px 48px;
        min-width: 0;
      }
      .map-pane {
        position: relative;
        min-height: 0;
        border-left: 1px solid var(--border);
        /* Contain Leaflet's internal z-indexes (panes 400-700, controls 1000) in their own
           stacking context — without this the map paints OVER app modals (onboarding z-90,
           paywall z-100). */
        z-index: 0;
        isolation: isolate;
      }
      @media (max-width: 959px) {
        .shell {
          display: flex;
          flex-direction: column;
          height: auto;
        }
        .map-pane {
          order: -1;
          height: 42vh;
          min-height: 260px;
          border-left: none;
          border-bottom: 1px solid var(--border);
        }
        .panel {
          padding: 14px 14px 40px;
        }
      }
      .top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 14px;
      }
      h1 {
        font-size: 28px;
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
      app-briefing-card,
      app-explore-panel {
        display: block;
        margin-top: 16px;
      }
      /* F-005: the Explore entry, sitting right above the briefing card (surface via .card). */
      .explore-open {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        width: 100%;
        margin-top: 16px;
        padding: 12px 14px;
        font: inherit;
        font-size: 14px;
        font-weight: 600;
        color: var(--text);
        cursor: pointer;
      }
      .explore-open:hover {
        border-color: var(--accent);
      }
      .explore-sub {
        font-size: 12px;
        font-weight: 500;
        color: var(--muted);
      }
      .summary {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: 12px;
        padding: 11px 14px;
        font-size: 13px;
        color: var(--muted);
      }
      .sum-drive {
        font-variant-numeric: tabular-nums;
      }
      .sum-arrive strong {
        color: var(--text);
        font-size: 14px;
        font-variant-numeric: tabular-nums;
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
  private readonly geocode = inject(GeocodeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly analytics = inject(AnalyticsService);

  // ADR-0038: no hardcoded demo route. A San Francisco → Los Angeles pair used to sit here as a
  // helpful demo when / WAS the planner; with a landing page in front, a stranger's first screen
  // pre-filled with someone else's trip reads as the app having misread them. Empty fields plus the
  // geolocation origin prefill (ADR-0026) is the correct initial state.
  readonly origin = signal<PlaceValue | null>(null);
  readonly destination = signal<PlaceValue | null>(null);

  departureAt = this.defaultDeparture();

  /** F-006: the ordered stop rows (max 3). Incomplete rows (no place yet) don't plan. */
  readonly stops = signal<StopDraft[]>([]);

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
  /** The endpoints the SHOWN plan was generated with (a signal — Explore binds to it). */
  readonly plannedContext = signal<{ origin: PlaceValue; destination: PlaceValue } | null>(null);
  /**
   * F-012: the SERVER trip id when this session opened a saved trip. Sent as `trip_id` so the
   * briefing diffs against that trip's stored baseline (ADR-0039) — the half of the re-brief that
   * survives a reload and crosses devices. Cleared the moment the user retargets the endpoints,
   * because the baseline belongs to that trip, not to whatever is in the form now.
   */
  private savedTrip: { id: string; endpointKey: string } | null = null;
  private scrubTimer: ReturnType<typeof setTimeout> | undefined;
  // F-006: what the shown plan/briefing were generated with — trip identity now includes the
  // waypoints + dwell (ADR-0031 §3), so stop edits know when to re-plan + refresh the briefing.
  private plannedWaypointsKey = '';
  private stopsTimer: ReturnType<typeof setTimeout> | undefined;
  // F-001 v2 (US-11): the last briefing's facts, keyed by full trip identity (endpoints +
  // departure + waypoints/dwell). Re-briefing the SAME trip sends them as `previous_facts` so the
  // server returns a grounded diff; any identity change means a different trip — nothing is sent.
  private readonly briefingMemory = new BriefingMemory();

  readonly canSubmit = computed(() => !!this.origin() && !!this.destination());

  /** Proximity bias for stop autocomplete: the midpoint of origin↔destination (the route corridor),
   *  so a typed stop name resolves near the trip — "Santa Fe" on an Austin→LA route is New Mexico,
   *  not somewhere on another continent. Falls back to whichever endpoint is set. */
  readonly stopBias = computed(() => {
    const o = this.origin();
    const d = this.destination();
    if (o && d) {
      return { latitude: (o.latitude + d.latitude) / 2, longitude: (o.longitude + d.longitude) / 2 };
    }
    return o ?? d ?? null;
  });

  // --- F-005 Trip Explorer state -----------------------------------------------------------------
  readonly exploreOpen = signal(false);
  /** The panel's current result cards → numbered map pins ([] = none). */
  readonly exploreCards = signal<PlaceCardModel[]>([]);
  /** Highlighted card/pin index, shared card-list ↔ map. */
  readonly exploreSelected = signal<number | null>(null);
  /** The departure the SHOWN plan used — the planned base plus any scrubbed offset. */
  readonly exploreDepartureAt = computed(() => {
    const base = this.plannedBase();
    return base ? new Date(base.getTime() + this.departureOffset() * 60_000).toISOString() : '';
  });
  /** The current effective waypoints (same composition the plan/briefing requests use). */
  readonly exploreWaypoints = computed(() => toWaypoints(this.stops()));

  /** Whether the currently-shown trip is in the saved list (reacts to saves + endpoint changes). */
  readonly isCurrentSaved = computed(() => {
    const o = this.origin();
    const d = this.destination();
    return !!o && !!d && this.trips.isSaved(o, d);
  });

  /** Session-only geolocation fix for the home map + origin prefill (ADR-0026); never persisted. */
  readonly userLocation = signal<{ latitude: number; longitude: number } | null>(null);

  ngOnInit(): void {
    // Know the entitlement/usage up front so gating is correct (server-authoritative; F-002).
    void this.entitlement.refresh();
    // A trip queued from Recents/Saved: prefill the fields (stops included — a saved multi-stop
    // trip re-plans as a multi-stop trip, F-006 US-4) and plan it immediately.
    const staged = this.trips.takeStaged();
    if (staged) {
      this.locate();
      this.origin.set(staged.origin);
      this.destination.set(staged.destination);
      this.stops.set(fromWaypoints(staged.waypoints));
      this.savedTrip = staged.savedTripId
        ? {
            id: staged.savedTripId,
            // Pinned to the endpoints it was staged for, so retargeting the form drops it.
            endpointKey: tripBaselineKey({
              origin: staged.origin,
              destination: staged.destination,
            }),
          }
        : null;
      if (staged.departureAt) this.departureAt = this.toLocalInput(new Date(staged.departureAt));
      void this.submit();
      return;
    }
    // ADR-0038: the landing-page form hands off as /plan?from=…&to=…. Absent params this is a no-op,
    // so today's behaviour is unchanged. Present params own the origin, so the geolocation prefill is
    // skipped — otherwise the async fix could land on top of the route the user just asked for.
    const params = this.route.snapshot.queryParamMap;
    const from = params.get('from')?.trim();
    const to = params.get('to')?.trim();
    if (from || to) {
      void this.applyHandoff(from, to);
      return;
    }
    this.locate();
  }

  /**
   * ADR-0038: resolve the landing page's `from`/`to` text to places and plan the trip.
   *
   * Both lookups run concurrently through the SAME geocoder the place fields use, and we take the
   * first result — the landing page sends city-level text ("Chicago, IL"), which is exactly what
   * Photon ranks well. A miss is NOT an error state: whatever resolved is filled in and the form is
   * left for the user to finish. Someone who just clicked a CTA must never meet an error page or an
   * empty planner.
   */
  private async applyHandoff(from?: string, to?: string): Promise<void> {
    const [origin, destination] = await Promise.all([this.resolve(from), this.resolve(to)]);
    if (origin) this.origin.set(origin);
    if (destination) this.destination.set(destination);

    // ADR-0025 §1 puts the wall at the VALUE ACTION, not the front door. Generating a briefing needs
    // a REAL account, so auto-submitting for a guest gets a 401 and `submit()` sends them to /login —
    // which turned a landing-page CTA click into a context-free sign-in page, the exact dead end the
    // handoff exists to avoid. For a guest we prefill and stop: they see the planner with their own
    // route in it, and meet the wall when they press Get briefing, where ADR-0025 intends it.
    const canPlan = !this.auth.configured() || this.auth.hasRealAccount();
    if (origin && destination && canPlan) {
      void this.submit();
      return;
    }
    // Guest, or a partial/failed lookup: fall back to the normal idle screen, including the
    // live-location map + origin prefill the user would otherwise have got.
    this.locate();
  }

  /**
   * First geocoder hit for a query, or null (blank, too short, no match, or the lookup failed).
   * Swallows failures HERE rather than relying on GeocodeService's own try/catch, so the "never show
   * a blank planner to someone who just clicked a CTA" guarantee doesn't depend on another class's
   * internals.
   */
  private async resolve(query?: string): Promise<PlaceValue | null> {
    if (!query) return null;
    try {
      const results = await this.geocode.search(query);
      return results[0] ?? null;
    } catch {
      return null;
    }
  }

  /**
   * ADR-0026: center the home map on the user and pre-fill the origin — permission-gated and
   * non-blocking. Denied/insecure-context/unavailable all fall back to the default view + manual
   * entry. Only fills an EMPTY origin: since ADR-0038 removed the hardcoded demo route, anything
   * already in the field was put there by the user, a saved trip, or a landing-page handoff.
   */
  private locate(): void {
    if (!('geolocation' in navigator) || !window.isSecureContext) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        this.userLocation.set(loc);
        if (!this.origin()) {
          this.origin.set({ name: 'Current location', ...loc });
        }
      },
      () => {
        /* denied or unavailable — keep defaults, never block (ADR-0026) */
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }

  /** Fill the destination with a favorite place (Home/Work). Origin keeps whatever the user set. */
  useFavorite(place: PlaceValue): void {
    this.destination.set(place);
  }

  async saveTrip(): Promise<void> {
    const origin = this.origin();
    const destination = this.destination();
    if (!origin || !destination) return;
    const p = this.plan();
    try {
      // Server-authoritative save/unsave (ADR-0029); the star reflects the server list.
      // F-006: stops + dwell persist with the trip and are restored on re-open (ADR-0030).
      await this.trips.toggleSave({
        origin,
        destination,
        departureAt: new Date(this.departureAt).toISOString(),
        distanceMeters: p?.distance_meters,
        durationSeconds: p?.duration_seconds,
        worstSeverity: p?.worst_severity as Severity | undefined,
        waypoints: toWaypoints(this.stops()),
      });
      // ADR-0037: only the SAVE direction is an activation signal (un-starring isn't), and only
      // after the server accepted it. No place names — the star state is the whole payload.
      if (this.trips.isSaved(origin, destination)) this.analytics.capture('trip_saved');
    } catch (e) {
      if (e instanceof AccountRequiredError) this.router.navigate(['/login']);
      else this.error.set('Could not update the saved trip. Please try again.');
    }
  }

  short(name: string): string {
    return name.split(',')[0];
  }

  /**
   * F-006 trip summary: "6 h 20 m drive + 45 m stops" from the SERVER's driving-only
   * `duration_seconds` and `total_dwell_seconds` — the client never computes its own ETAs
   * (ADR-0011).
   */
  summaryLabel(p: PlanTripResponse): string {
    const drive = `${formatDuration(p.duration_seconds)} drive`;
    const dwell = p.total_dwell_seconds ?? 0;
    return dwell > 0 ? `${drive} + ${formatDuration(dwell)} stops` : drive;
  }

  /** The server's `arrival_at` (dwell already included) as a local wall-clock time. */
  arriveLabel(p: PlanTripResponse): string {
    return new Date(p.arrival_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

  /**
   * F-006: every effective stop edit (add/remove/reorder/dwell) re-plans, debounced so slamming
   * the dwell picker fires one request. Edits that don't change the planned waypoints (e.g. an
   * empty row added/removed) are ignored. A stop edit also refreshes the briefing — trip identity
   * includes waypoints + dwell, so the shown briefing is stale (F-001 US-3 / ADR-0031 §3).
   */
  onStopsChange(next: StopDraft[]): void {
    this.stops.set(next);
    if (!this.plannedContext()) return; // nothing planned yet — stops apply on the next submit
    if (waypointsKey(toWaypoints(next)) === this.plannedWaypointsKey) return;
    clearTimeout(this.stopsTimer);
    this.stopsTimer = setTimeout(() => void this.replan({ refreshBriefing: true }), 400);
  }

  /**
   * F-006: map long-press drops a stop at the pressed location while a trip is planned or being
   * planned (and under the cap). The name comes from reverse geocoding (fast; a failure falls
   * back to a "Stop N (lat, lon)" label), then the edit flows through {@link onStopsChange}.
   */
  async addStopFromMap(loc: { latitude: number; longitude: number }): Promise<void> {
    if (this.stops().length >= MAX_STOPS) return;
    if (!this.plan() && !this.loading() && !this.canSubmit()) return;
    const found = await this.geocode.reverse(loc.latitude, loc.longitude);
    const name =
      found?.name ??
      `Stop ${this.stops().length + 1} (${loc.latitude.toFixed(3)}, ${loc.longitude.toFixed(3)})`;
    if (this.stops().length >= MAX_STOPS) return; // re-check after the await
    this.onStopsChange([
      ...this.stops(),
      newStop({ name, latitude: loc.latitude, longitude: loc.longitude }),
    ]);
  }

  /**
   * F-005: a confirmed add-as-stop from the Explore panel — routed through the EXISTING F-006
   * stop-list flow ({@link onStopsChange}: debounced re-plan + briefing refresh), with the dwell
   * the user chose in the preview.
   */
  onExploreAddStop(event: { place: PlaceValue; dwellMinutes: DwellMinutes }): void {
    if (this.stops().length >= MAX_STOPS) return;
    this.onStopsChange([...this.stops(), newStop(event.place, event.dwellMinutes)]);
  }

  /** Panel result cards → numbered map pins (a fresh set resets the highlight). Ordered start→end
   *  along the route (by `along_route_meters`), not by relevance score, so the numbered pins + list
   *  read in travel sequence — 1 nearest the origin, the last nearest the destination. */
  onExploreCards(cards: PlaceCardModel[]): void {
    const ordered = [...cards].sort((a, b) => a.along_route_meters - b.along_route_meters);
    this.exploreCards.set(ordered);
    this.exploreSelected.set(null);
  }

  /** Card click/hover ↔ pin click: highlight the pair AND select the card's nearest sample. */
  onExploreHighlight(index: number | null): void {
    this.exploreSelected.set(index);
    const card = index != null ? this.exploreCards()[index] : null;
    if (card) this.selected.set(card.nearest_sample_index);
  }

  closeExplore(): void {
    this.exploreOpen.set(false);
    this.exploreCards.set([]);
    this.exploreSelected.set(null);
  }

  /**
   * The staged saved-trip id, but ONLY while the form still points at that trip's endpoints. A
   * submit can retarget them, and the server baseline belongs to the trip it was stored on — sending
   * it for a different route would diff two unrelated trips, which is the one thing F-012 must not do.
   */
  private savedTripIdFor(origin: PlaceValue, destination: PlaceValue): string | undefined {
    const saved = this.savedTrip;
    if (!saved) return undefined;
    if (saved.endpointKey !== tripBaselineKey({ origin, destination })) {
      this.savedTrip = null;
      return undefined;
    }
    return saved.id;
  }

  private async replan(opts: { refreshBriefing?: boolean } = {}): Promise<void> {
    const base = this.plannedBase();
    const ctx = this.plannedContext();
    if (!base || !ctx) return;
    const departureAt = new Date(base.getTime() + this.departureOffset() * 60_000).toISOString();
    const waypoints = toWaypoints(this.stops());
    // F-012: previous_facts now ride along across a PLAN edit of the same trip — the departure
    // scrubber and stop edits are exactly the cases worth diffing. The identity key still governs
    // whether the SHOWN briefing is stale (ADR-0031 §3); the baseline key governs what to diff
    // against. A genuinely different trip still matches nothing.
    const savedTripId = this.savedTripIdFor(ctx.origin, ctx.destination);
    const baselineKey = tripBaselineKey({ ...ctx, savedTripId });
    const previousFacts = this.briefingMemory.previousFactsFor(baselineKey);
    this.replanning.set(true);
    try {
      const [plan, briefing] = await Promise.all([
        this.api.planTrip(buildPlanRequest({ ...ctx, departureAt, waypoints })),
        opts.refreshBriefing
          ? this.api.createBriefing(
              buildBriefingRequest({
                ...ctx,
                departureAt,
                waypoints,
                units: this.settings.units(),
                previousFacts,
                savedTripId,
              }),
            )
          : Promise.resolve(null),
      ]);
      this.plan.set(plan);
      if (briefing) {
        this.briefing.set(briefing);
        this.briefingMemory.remember(baselineKey, briefing.facts);
      }
      this.plannedWaypointsKey = waypointsKey(waypoints);
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
    // Reversing the trip reverses the stop order too (F-006 — order is part of the route). Like
    // the endpoint swap itself, this applies on the next submit; it never re-plans by itself.
    this.stops.set([...this.stops()].reverse());
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
    // A new plan is a new trip — any open Explore session (results, pins) is for the old one.
    this.closeExplore();

    const base = new Date(this.departureAt);
    const departureAt = base.toISOString();
    // F-006: the plan AND the briefing carry the same waypoints (the briefing narrates the stops).
    const waypoints = toWaypoints(this.stops());
    // F-012 re-brief: the prior facts for this TRIP (endpoints), whatever plan version they were
    // generated for — so re-submitting with a moved departure still produces a labelled diff.
    const savedTripId = this.savedTripIdFor(origin, destination);
    const baselineKey = tripBaselineKey({ origin, destination, savedTripId });
    const previousFacts = this.briefingMemory.previousFactsFor(baselineKey);
    try {
      const [plan, briefing] = await Promise.all([
        this.api.planTrip(buildPlanRequest({ origin, destination, departureAt, waypoints })),
        this.api.createBriefing(
          buildBriefingRequest({
            origin,
            destination,
            departureAt,
            waypoints,
            units: this.settings.units(),
            previousFacts,
            savedTripId,
          }),
        ),
      ]);
      // ADR-0037 activation event, matching the iOS `trip_planned` (same name, same `distance_mi`
      // property). Whole miles only — never the endpoints.
      this.analytics.capture('trip_planned', {
        distance_mi: Math.round(plan.distance_meters / 1609.344),
      });
      this.plan.set(plan);
      this.briefing.set(briefing);
      this.briefingMemory.remember(baselineKey, briefing.facts);
      this.plannedContext.set({ origin, destination });
      this.plannedBase.set(base);
      this.plannedWaypointsKey = waypointsKey(waypoints);
      // My Trips → Recent (local history): remember every trip you plan.
      this.trips.recordRecent({
        origin,
        destination,
        departureAt,
        distanceMeters: plan.distance_meters,
        worstSeverity: plan.worst_severity,
        waypoints,
      });
    } catch (e) {
      if (e instanceof AccountRequiredError) {
        // ADR-0025 auth wall: Show Weather requires a signed-in account -> go to the sign-in page.
        this.router.navigate(['/login']);
      } else if (e instanceof PaywallError) {
        // Signed in but not entitled -> show the server's store-trial paywall, not a generic error.
        // ADR-0037: the 402 IS the free-cap block — the funnel step between "tried to plan" and
        // "saw the paywall". `reason` is the server's coarse machine string, never a place.
        this.analytics.capture('route_blocked_free_cap', { trigger: e.payload.reason });
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
