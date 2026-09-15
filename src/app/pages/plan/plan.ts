import { Component, DestroyRef, type OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type {
  BriefingFactsModel,
  SavedTripModel,
  BriefingResponse,
  DaySnapshotModel,
  ItineraryBriefingResponse,
  OutlookResponse,
  PlaceCardModel,
  PlanItineraryResponse,
  PlanTripResponse,
  WaypointModel,
} from '@road-travel/sdk';

import { OutlookPanel } from './outlook-panel';
import { AnalyticsService } from '../../core/analytics.service';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { EntitlementService } from '../../core/entitlement.service';
import { AccountRequiredError, ApiError, PaywallError } from '../../core/errors';
import { FORECAST_HORIZON_DAYS, dayLabel, isoDay, tierFor } from '../../core/forecast-horizon';
import { GeocodeService } from '../../core/geocode.service';
import { PaywallService } from '../../core/paywall.service';
import { SettingsService } from '../../core/settings.service';
import { type StagedTrip, TripsService } from '../../core/trips.service';
import { IconComponent } from '../../ui/icon';
import { AheadBanner } from './ahead-banner';
import { BriefingCard } from './briefing-card';
import { ExplorePanel } from './explore-panel';
import { PlaceField, type PlaceValue } from './place-field';
import { BriefingMemory, tripBaselineKey, tripIdentityKey } from './rebrief';
import { RouteMap } from './route-map';
import { SnapshotLine } from './snapshot-line';
import { SEVERITY_FALLBACK, SEVERITY_RANK, formatDuration, severityOrFallback } from './severity';
import { StopsEditor } from './stops-editor';
import { StopsSummary, deriveTripDays } from './stops-summary';
import { Timeline } from './timeline';
import { TripBriefingCard } from './trip-briefing-card';
import {
  type DecodedSnapshot,
  type SnapshotSource,
  buildSnapshotRequest,
  decodeTripSnapshot,
  isSnapshotExpired,
} from './trip-snapshot';
import {
  type DwellMinutes,
  MAX_STOPS,
  type StopDraft,
  buildBriefingRequest,
  buildItineraryBriefingRequest,
  buildItineraryRequest,
  buildPlanRequest,
  fromWaypoints,
  localTimezone,
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
  imports: [
    FormsModule,
    RouterLink,
    PlaceField,
    StopsSummary,
    StopsEditor,
    RouteMap,
    Timeline,
    BriefingCard,
    TripBriefingCard,
    AheadBanner,
    ExplorePanel,
    OutlookPanel,
    SnapshotLine,
    IconComponent,
  ],
  template: `
    <div class="shell">
      <section class="panel">
        <header class="top">
          <h1>Plan a drive</h1>
          <div class="actions">
            <!-- No save toggle here any more. Planning a trip saves it, so a star could only ever
                 read as already-saved — and the one it replaced meant a trip reached the server
                 ONLY if the traveller pressed it, which in thirty days of production nobody did.
                 Deleting a trip stays deliberate, and lives in My Trips. -->
            @if (!auth.configured() || auth.hasRealAccount()) {
              <!-- ADR-0025 §1: My Trips is LOGIN-ONLY — hidden from guests (the route is walled by
                 realAccountGuard). ADR-0029 removed Recents; this is the server's whole list. -->
              <a class="icon" routerLink="/saved" aria-label="My trips" title="My trips"
                ><app-icon name="bookmark" [size]="16"
              /></a>
            }
          </div>
        </header>

        <div class="inputs card">
          <app-place-field
            kind="origin"
            placeholder="Origin"
            [place]="origin()"
            [near]="originBias()"
            (placeChange)="origin.set($event)"
          />
          <div class="divider">
            <button
              class="swap"
              type="button"
              (click)="swap()"
              aria-label="Swap origin and destination"
            >
              <app-icon name="arrow-up-down" [size]="14" />
            </button>
          </div>
          <!-- Every stop, however many, is this one line. Listing them here pushed the map off
               a phone screen at two overnight stops; they are edited in the stops editor. -->
          <app-stops-summary [stops]="stops()" (edit)="stopsEditorOpen.set(true)" />
          <div class="divider"></div>
          <app-place-field
            kind="destination"
            placeholder="Destination"
            [place]="destination()"
            [near]="destinationBias()"
            (placeChange)="destination.set($event)"
          />
        </div>

        @if (settings.home() || settings.work()) {
          <div class="favs">
            <span class="favs-label">Go to</span>
            @if (settings.home(); as h) {
              <button class="chip" (click)="useFavorite(h)" title="Set destination to Home">
                <app-icon name="house" [size]="13" /> Home
              </button>
            }
            @if (settings.work(); as w) {
              <button class="chip" (click)="useFavorite(w)" title="Set destination to Work">
                <app-icon name="briefcase" [size]="13" /> Work
              </button>
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
            <select
              [ngModel]="settings.units()"
              (ngModelChange)="settings.setUnits($event)"
              name="units"
            >
              <option value="imperial">mi / °F</option>
              <option value="metric">km / °C</option>
            </select>
          </label>
          <button class="go" (click)="submit()" [disabled]="loading() || !canSubmit()">
            {{ loading() ? (opening() ? 'Opening…' : 'Planning…') : 'Get briefing' }}
          </button>
        </div>

        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }

        @if (snapshotShown(); as snap) {
          <!-- The result below is the trip as it was last planned, not a fresh one. Said first,
               above everything it dates, and gone the moment a fresh result replaces it. -->
          <app-snapshot-line
            [plannedAt]="snap.plannedAt"
            [departureAt]="snap.departureAt"
            [busy]="loading() || replanning()"
            (refresh)="refresh()"
          />
        }

        @if (outlook(); as o) {
          <!-- A date past the forecast. Its own surface, never the forecast timeline. -->
          <h3 class="section">Typical conditions</h3>
          <app-outlook-panel [outlook]="o" [units]="settings.units()" />
        }
        @if (shownDayNote(); as note) {
          <!-- The selected day has no route to draw. Said here rather than left as a gap where the
               timeline would be: both reasons are answers, and neither is the page's error state. -->
          <h3 class="section">Along the way</h3>
          <p class="day-of">{{ shownDayHeading() }}</p>
          <p class="beyond-note">{{ note }}</p>
        }
        @if (shownPlan(); as p) {
          <app-ahead-banner [plan]="p" [units]="settings.units()" />
          <!-- F-006 trip summary: driving time + total dwell + arrival, all SERVER values
             (arrival_at already includes dwell; duration_seconds stays driving-only). -->
          <div class="summary card">
            <span class="sum-drive">{{ summaryLabel(p) }}</span>
            <span class="sum-arrive"
              >arrive <strong>{{ arriveLabel(p) }}</strong></span
            >
          </div>
          <div class="scrubber card">
            <div class="scrub-head">
              <!-- Named on a multi-day trip, because this control moves the TRIP's departure, and
                   every later day that never stated its own hour follows it. Calling it just
                   "Departure" next to a timeline showing day 3 would read as day 3's. -->
              <span>{{ itinerary() ? 'Trip departure' : 'Departure' }}</span>
              <strong>{{ shiftedLabel() }}</strong>
              @if (replanning()) {
                <span class="rescan">re-checking…</span>
              }
            </div>
            <input
              type="range"
              [min]="earliestOffset()"
              [max]="LATEST_OFFSET"
              [step]="scrubStep()"
              [value]="departureOffset()"
              (input)="onScrub($event)"
              [style.background]="scrubGradient()"
              aria-label="Shift departure time"
              [attr.aria-valuetext]="scrubLabel()"
            />
            <div class="scrub-ticks">
              <span>{{ earliestLabel() }}</span>
              <span class="scrub-now">planned</span>
              <span>+6h</span>
            </div>
          </div>
          <h3 class="section">Along the way</h3>
          @if (shownDayHeading(); as heading) {
            <!-- The timeline and map below are ONE day of this trip. Saying which one is the whole
                 point: the same strip used to be shown as the whole drive while the day list above
                 dated its legs days apart. -->
            <p class="day-of">{{ heading }}</p>
          }
          @if (hasBeyondForecast()) {
            <!-- A grey stretch on the map and an empty cell in the timeline read as a glitch. This
               reads as an answer: there is no forecast yet, and there will be. -->
            <p class="beyond-note">
              Part of this trip is past the {{ horizonDays }}-day forecast. We'll have it closer to the day.
            </p>
          }
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
              <span class="explore-label"
                ><app-icon name="compass" [size]="15" /> Explore along the way</span
              >
              <span class="explore-sub">stops · food · fuel · scenic</span>
            </button>
          } @else if (exploreContext(); as ctx) {
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
        @if (tripBriefing(); as tb) {
          <!-- The whole-trip briefing, which is a different SCOPE from everything above it: the
               timeline and map are one day, this is every day. The card says so itself and marks
               the day that is on screen, and its day rows move the selection — so the two can be
               read against each other instead of quietly disagreeing. -->
          <app-trip-briefing-card
            [briefing]="tb"
            [units]="settings.units()"
            [selectedDay]="selectedDay()"
            (selectedDayChange)="onSelectDay($event)"
          />
        }
      </section>

      @if (stopsEditorOpen()) {
        <!-- The per-day list lives here now, beside the stops that produce it. -->
        <app-stops-editor
          [stops]="stops()"
          [origin]="origin()"
          [destination]="destination()"
          [departureAt]="departureAt()"
          [near]="searchBias()"
          [days]="itinerary()?.days ?? null"
          [longDayOrdinals]="itinerary()?.long_day_ordinals ?? []"
          [units]="settings.units()"
          [selectedDay]="itinerary() ? selectedDay() : null"
          (selectedDayChange)="onSelectDay($event)"
          (done)="onStopsEditorDone($event)"
        />
      }

      <!-- ADR-0026: the dominant map pane fills the remaining viewport. Always mounted — idle it
           shows the live-location home map; after planning, the severity-colored route. -->
      <aside class="map-pane">
        <app-route-map
          [plan]="shownPlan()"
          [day]="mapDay()"
          [dayBeyondForecast]="shownDay()?.beyond_forecast ?? false"
          [userLocation]="userLocation()"
          [wheelZoom]="desktopLayout()"
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
      /* One-canvas shell (kit option 3a): the map fills the viewport below the header and the
         trip panel floats over it, left — cream surface, radius 20, shadow-lg, own scroll.
         Stacks on mobile. */
      .shell {
        position: relative;
        height: calc(100dvh - 73px); /* viewport minus the app header */
        min-height: 480px;
      }
      .panel {
        position: absolute;
        top: 16px;
        left: 16px;
        bottom: 16px;
        width: min(352px, calc(100vw - 32px));
        z-index: 1;
        overflow-y: auto;
        padding: 18px;
        border-radius: 20px;
        background: var(--bg);
        box-shadow: var(--shadow-lg);
      }
      .map-pane {
        position: absolute;
        inset: 0;
        min-height: 0;
        /* Contain Leaflet's internal z-indexes (panes 400-700, controls 1000) in their own
           stacking context — without this the map paints OVER app modals (onboarding z-90,
           paywall z-100). */
        z-index: 0;
        isolation: isolate;
      }
      /* A phone reads top to bottom: the trip, then its map, then everything else. The map is one
         Leaflet instance outside the panel, so rather than move it, the panel dissolves
         (display: contents) and its children take places in the shell's order around the map.
         The map's height is fixed, never what the panel leaves over, so no number of stops can
         squeeze it. */
      @media (max-width: 959px) {
        .shell {
          display: flex;
          flex-direction: column;
          height: auto;
          padding: 14px 14px 40px;
        }
        .panel {
          display: contents;
        }
        .panel > * {
          order: 2;
        }
        .panel > .top,
        .panel > .inputs,
        .panel > .favs {
          order: 0;
        }
        .map-pane {
          position: static;
          order: 1;
          height: 46vh;
          min-height: 300px;
          margin: 12px -14px 0;
          border-block: 1px solid var(--border);
        }
      }
      .top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 14px;
      }
      h1 {
        font-size: 24px;
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
        border: none;
        background: var(--surface);
        color: var(--text);
        box-shadow: var(--shadow-sm);
        cursor: pointer;
        text-decoration: none;
        padding: 0;
        transition: background 150ms ease-out;
      }
      .icon:hover {
        background: var(--surface-2);
        text-decoration: none;
      }
      .icon:disabled {
        opacity: 0.45;
        cursor: default;
      }
      .card {
        background: var(--surface);
        border: none;
        border-radius: var(--radius);
        box-shadow: var(--shadow-sm);
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
        display: inline-flex;
        align-items: center;
        gap: 5px;
        border: 2px solid var(--border);
        background: var(--surface);
        color: var(--text);
        font: 600 13px var(--font-body);
        padding: 6px 13px;
        border-radius: var(--radius-pill);
        cursor: pointer;
        white-space: nowrap;
        transition:
          background 150ms ease-out,
          border-color 150ms ease-out;
      }
      .chip:hover {
        background: var(--accent-100);
        border-color: var(--accent-300);
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
        top: -16px;
        width: 32px;
        height: 32px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        border: none;
        background: var(--surface-2);
        color: var(--accent-700);
        box-shadow: var(--shadow-sm);
        cursor: pointer;
        transition: background 150ms ease-out;
      }
      .swap:hover {
        background: var(--accent-100);
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
        padding: 8px 14px;
        border: 1.5px solid var(--border);
        border-radius: var(--radius-pill);
        font: 600 13px var(--font-body);
        background: var(--surface);
        color: var(--text);
        transition: border-color 150ms ease-out;
      }
      .go {
        margin-left: auto;
        flex: 1 1 100%;
        background: var(--accent);
        color: var(--accent-contrast);
        border: none;
        border-radius: var(--radius-pill);
        padding: 13px 20px;
        font: 700 15px var(--font-body);
        cursor: pointer;
        box-shadow: var(--shadow-md);
        transition: background 150ms ease-out;
      }
      .go:hover {
        background: var(--accent-hover);
      }
      .go:disabled {
        opacity: 0.45;
        cursor: default;
      }
      .error {
        background: var(--accent-100);
        border: 1.5px solid var(--accent-300);
        color: var(--sev-severe);
        font-weight: 600;
        padding: 10px 14px;
        border-radius: var(--radius-md);
        margin: 14px 0;
      }
      .section {
        font: 800 11px var(--font-body);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--muted);
        margin: 18px 0 8px;
      }
      /* Which travel day everything below belongs to. Full-strength ink, unlike the muted notes
         around it — it is the heading's other half, not an aside. */
      .day-of {
        margin: -4px 0 8px;
        font: 700 13px var(--font-body);
        color: var(--text);
      }
      app-ahead-banner,
      app-route-map,
      .beyond-note {
        margin: 0 0 10px;
        padding: 8px 10px;
        border-radius: 10px;
        background: var(--well, #f9f4ed);
        color: var(--text-secondary, #82796a);
        font-size: 13px;
        font-weight: 500;
      }
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
      .explore-label {
        display: inline-flex;
        align-items: center;
        gap: 7px;
      }
      .explore-sub {
        font-size: 12px;
        font-weight: 500;
        color: var(--muted);
      }
      /* The arrival heading (kit 3a): Caprasimo display time over the drive meta. */
      .summary {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: 12px;
        padding: 12px 14px;
        font-size: 13px;
        font-weight: 600;
        color: var(--muted);
      }
      .sum-drive {
        font-variant-numeric: tabular-nums;
      }
      .sum-arrive strong {
        color: var(--text);
        font-family: var(--font-heading);
        font-weight: 400;
        font-size: 24px;
        line-height: 1.1;
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
      /* Condition-band scrub (kit 1d): the track IS the trip — colored by what you'll hit
         ([style.background] gradient) — with a white accent-ringed handle. */
      .scrubber input[type='range'] {
        width: 100%;
        appearance: none;
        -webkit-appearance: none;
        height: 13px;
        border-radius: var(--radius-pill);
        background: var(--cond-clear);
        outline-offset: 4px;
        cursor: pointer;
      }
      .scrubber input[type='range']::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: var(--route-casing);
        border: 3px solid var(--accent);
        box-shadow: var(--shadow-md);
      }
      .scrubber input[type='range']::-moz-range-thumb {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--route-casing);
        border: 3px solid var(--accent);
        box-shadow: var(--shadow-md);
      }
      .scrub-now {
        /* The planned time is not the middle of the track unless a full six hours of earlier is
           available, so it is labelled rather than positioned. */
        font-weight: 700;
        color: var(--text-secondary);
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

  /**
   * A signal rather than a plain field because the derived travel days are computed FROM it —
   * a date typed here has to move the days list on the same keystroke, with nothing to re-plan.
   */
  readonly departureAt = signal(this.defaultDeparture());

  /** F-006: the ordered stop rows. Incomplete rows (no place yet) don't plan. */
  readonly stops = signal<StopDraft[]>([]);
  readonly stopsEditorOpen = signal(false);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  /** The ONE-day result. Null whenever the trip is driven over more than a day — see `itinerary`. */
  readonly plan = signal<PlanTripResponse | null>(null);
  /**
   * The multi-day result: one plan per travel day, each made at that day's own departure instant.
   *
   * A separate signal from `plan` rather than a superset of it, and never both at once. The planner
   * used to route a fortnight as a single drive from a single departure, so the days card could say
   * a leg was driven on the 8th while the timeline underneath showed the 1st's weather for it. Two
   * signals make that state unrepresentable: whichever one is set is the whole answer.
   */
  readonly itinerary = signal<PlanItineraryResponse | null>(null);
  /**
   * Which travel day the timeline, map and Explore below are showing. An ordinal, matching the
   * derived legs and the server's days — not an index, so it survives a response that came back
   * with a different number of days than the stops now imply.
   */
  readonly selectedDay = signal(0);
  /** Set instead of `plan` for a date past the horizon. Never both — they are different answers. */
  readonly outlook = signal<OutlookResponse | null>(null);
  readonly briefing = signal<BriefingResponse | null>(null);
  /**
   * The whole-trip briefing: one paragraph over every travel day, each narrated from its own date.
   *
   * A second signal rather than a widened `briefing`, and never both at once — the same shape the
   * plan/itinerary pair takes, for the same reason. `/v1/briefings` answers one departure instant
   * and `/v1/briefings/itinerary` answers a trip; letting one field hold either would leave the
   * card below deciding which kind of statement it was rendering, which is how a day-scoped
   * sentence ends up captioned as a trip.
   */
  readonly tripBriefing = signal<ItineraryBriefingResponse | null>(null);
  /** Selected route-sample index, shared between the map and the timeline. */
  readonly selected = signal<number | null>(null);

  // Departure scrubber: nudge the planned departure forward and re-fetch the route weather (mirrors
  // the iOS result-screen scrubber). The briefing text stays as first generated.
  readonly departureOffset = signal(0); // minutes either side of the planned departure

  /**
   * How far the scrubber reaches forward, and how far back.
   *
   * Backwards is the half that matters — "if I leave two hours earlier I get ahead of the band" is
   * the most common weather-driving decision there is, and the control could not express it at all.
   * The backward bound is NOT a flat -360: you cannot leave before now, and the forecast has no
   * hours behind the present either, so it narrows to whatever is actually left before the planned
   * departure.
   */
  readonly LATEST_OFFSET = 360;
  readonly earliestOffset = computed(() => {
    const base = this.plannedBase();
    if (!base) return 0;
    const untilDeparture = (base.getTime() - Date.now()) / 60_000;
    return -Math.min(360, Math.max(0, Math.round(untilDeparture / 5) * 5));
  });
  /**
   * Coarser further out. A flat 5-minute step across 12 hours is 144 positions in a few hundred
   * pixels — finer than a pointer can land, and it makes the near-term choices people actually
   * make the hardest ones to hit.
   */
  readonly scrubStep = computed(() => (Math.abs(this.departureOffset()) < 60 ? 5 : 15));

  /** "−2h30" / "+45m" / "planned" — the tick under the left end, and the a11y value. */
  readonly earliestLabel = computed(() => {
    const earliest = this.earliestOffset();
    return earliest === 0 ? 'now' : `−${Plan.compactOffset(-earliest)}`;
  });
  readonly scrubLabel = computed(() => {
    const offset = this.departureOffset();
    if (offset === 0) return 'leaving at the planned time';
    const magnitude = Plan.compactOffset(Math.abs(offset));
    return offset < 0 ? `${magnitude} earlier` : `${magnitude} later`;
  });

  static compactOffset(minutes: number): string {
    const total = Math.round(minutes);
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    if (hours === 0) return `${mins}m`;
    return mins === 0 ? `${hours}h` : `${hours}h${mins}`;
  }
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

  /**
   * Set while the result on screen came from the trip's stored snapshot rather than from planning
   * it just now — the dated line reads it. Cleared by any fresh result.
   */
  readonly snapshotShown = signal<{ plannedAt: string; departureAt: string } | null>(null);
  /** The one snapshot GET is in flight — the button says Opening, not Planning, because it isn't. */
  readonly opening = signal(false);
  /**
   * The server's own bodies for the result on screen, exactly as they came back — the source of the
   * snapshot PUT. Kept apart from the display signals because what is DISPLAYED can differ: a
   * briefing opened from a snapshot is shown without its old diff, but stored with it.
   */
  private shownResult: SnapshotSource | null = null;
  private scrubTimer: ReturnType<typeof setTimeout> | undefined;
  // F-006: what the shown plan/briefing were generated with — trip identity now includes the
  // waypoints + dwell (ADR-0031 §3), so stop edits know when to re-plan + refresh the briefing.
  private plannedWaypointsKey = '';
  private stopsTimer: ReturnType<typeof setTimeout> | undefined;
  // F-001 v2 (US-11): the last briefing's baseline for this TRIP, keyed by `tripBaselineKey`.
  // Re-briefing the same trip sends it back — `previous_facts` on the single-day path, and (since
  // multi-day trips brief through `/v1/briefings/itinerary`) `previous_snapshot` on the whole-trip
  // one — so the server returns a grounded diff. A different trip keys to nothing and sends nothing.
  private readonly briefingMemory = new BriefingMemory();

  readonly canSubmit = computed(() => !!this.origin() && !!this.destination());

  /**
   * The scrubber's condition band (kit option 1d): the track is a linear gradient of what the
   * trip will hit — clear / clouds / rain / heavy per sample, positioned by distance fraction.
   * Uses var(--cond-*) names so the band re-tints live when the theme flips. Presentation only.
   *
   * Reads the SHOWN plan, like everything else under the day list: the track sits directly above a
   * timeline that is one day of the trip, and banding it from a different day's samples would be
   * the contradiction back again in the one place nobody would think to look.
   */
  readonly scrubGradient = computed(() => {
    const p = this.shownPlan();
    const samples = p?.samples ?? [];
    const last = samples[samples.length - 1];
    const total = last?.distance_from_start_meters ?? 0;
    if (!total) return 'var(--cond-clear)';
    const stops: string[] = [];
    let prev = 0;
    for (const s of samples) {
      const frac = Math.min((s.distance_from_start_meters / total) * 100, 100);
      const w = s.weather;
      let cond = 'var(--cond-clear)';
      // Ranked, not enumerated. The old chain tested `=== 'severe'` then `=== 'caution'` and let
      // everything else fall through to the clear band — so a level this build predates painted
      // the band the same colour as a sunny afternoon. Anything above caution reads as heavy.
      const sev = w ? severityOrFallback(w.severity) : null;
      if (sev != null && SEVERITY_RANK[sev] >= SEVERITY_RANK.high) cond = 'var(--cond-heavy)';
      else if (sev === 'caution') cond = 'var(--cond-rain)';
      else {
        const texture = `${w?.condition_symbol ?? ''} ${w?.condition_text ?? ''}`.toLowerCase();
        if (/cloud|overcast|fog|haze|mist/.test(texture)) cond = 'var(--cond-clouds)';
      }
      stops.push(`${cond} ${prev.toFixed(1)}%`, `${cond} ${frac.toFixed(1)}%`);
      prev = frac;
    }
    return `linear-gradient(to right, ${stops.join(', ')})`;
  });

  /** Proximity bias for autocomplete: the midpoint of origin↔destination (the route corridor), so
   *  a typed stop name resolves near the trip — "Santa Fe" on an Austin→LA route is New Mexico, not
   *  somewhere on another continent.
   *
   *  Falls back to whichever endpoint is set, and then to the user's own location. That last step is
   *  the one that was missing: someone who opens the planner and types a STOP before filling in
   *  either endpoint got no bias at all, and Photon's unbiased global ranking answers "san" with
   *  Poland, San Marino, Chile and Costa Rica. Which is what the planner was showing.
   *
   *  iOS never had the problem because MKLocalSearchCompleter defaults its region to where the user
   *  is. This makes the web planner do the same thing. */
  /** Origin autocomplete looks toward the other end of the trip, then to where the user is. */
  readonly originBias = computed(() => this.destination() ?? this.userLocation());
  /** ...and the destination field looks back toward the origin, same fallback. */
  readonly destinationBias = computed(() => this.origin() ?? this.userLocation());

  readonly searchBias = computed(() => {
    const o = this.origin();
    const d = this.destination();
    if (o && d) {
      return {
        latitude: (o.latitude + d.latitude) / 2,
        longitude: (o.longitude + d.longitude) / 2,
      };
    }
    return o ?? d ?? this.userLocation();
  });

  // --- F-005 Trip Explorer state -----------------------------------------------------------------
  readonly exploreOpen = signal(false);
  /** The panel's current result cards → numbered map pins ([] = none). */
  readonly exploreCards = signal<PlaceCardModel[]>([]);
  /** Highlighted card/pin index, shared card-list ↔ map. */
  readonly exploreSelected = signal<number | null>(null);
  /**
   * The departure the SHOWN plan used — the planned base plus any scrubbed offset.
   *
   * On a multi-day trip it is the SERVER's `departure_at` for the selected day instead, because
   * that day sets off from the stop it slept at, days after the trip did. Handing Explore the
   * trip's own departure would rank "somewhere to eat" against the wrong day's conditions — the
   * same substitution the day-by-day planning exists to remove, one surface further down.
   */
  readonly exploreDepartureAt = computed(() => {
    if (this.itinerary()) return this.shownPlan()?.departure_at ?? '';
    const base = this.plannedBase();
    return base ? new Date(base.getTime() + this.departureOffset() * 60_000).toISOString() : '';
  });
  /**
   * The waypoints of the corridor being explored: the whole trip's on a one-day trip, and the
   * selected day's pass-through stops on a multi-day one.
   *
   * Matched back to the full waypoint rows by place rather than rebuilt from the leg, so each one
   * keeps the dwell the traveller chose — a leg carries only the place.
   */
  readonly exploreWaypoints = computed(() => {
    const all = toWaypoints(this.stops());
    const leg = this.shownLeg();
    if (!leg) return all;
    const key = (p: { name: string; latitude: number; longitude: number }) =>
      `${p.name}@${p.latitude},${p.longitude}`;
    const onThisDay = new Set(leg.waypoints.map(key));
    return all.filter((w) => onThisDay.has(key(w)));
  });
  /** The endpoints Explore searches between — the selected day's, on a multi-day trip. */
  readonly exploreContext = computed(() => {
    const leg = this.shownLeg();
    return leg ? { origin: leg.origin, destination: leg.destination } : this.plannedContext();
  });

  /**
   * The travel days the current stops imply — derived locally, from the same waypoints the plan
   * request carries, so they appear as the traveller types rather than after a round trip.
   *
   * Empty until both endpoints are picked: a day from an unnamed place to an unnamed place is not
   * something to show anyone.
   */
  readonly travelDays = computed(() =>
    deriveTripDays({
      origin: this.origin(),
      destination: this.destination(),
      stops: this.stops(),
      departureAt: this.departureAt(),
    }),
  );

  /** Anything planned at all — a one-day plan or a multi-day itinerary. */
  readonly planned = computed(() => !!this.plan() || !!this.itinerary());

  /** The selected travel day's record, when this is a multi-day trip. */
  readonly shownDay = computed(() => {
    const itinerary = this.itinerary();
    if (!itinerary) return null;
    return itinerary.days.find((d) => d.ordinal === this.selectedDay()) ?? null;
  });

  /**
   * The plan the timeline, map, summary and Explore are all reading from.
   *
   * ONE plan, whichever kind of trip this is: a one-day trip's whole route, or the selected day's.
   * Every surface below the day list binds to this rather than to `plan` directly, which is what
   * stops the map and the day list from describing different drives.
   *
   * Null on a multi-day trip whose selected day has no plan — beyond the forecast, or unroutable.
   * Those are answers, not empty states, and {@link shownDayNote} is what says which one it is.
   */
  readonly shownPlan = computed<PlanTripResponse | null>(() => {
    if (!this.itinerary()) return this.plan();
    return this.shownDay()?.plan ?? null;
  });

  /**
   * The day the map names in its no-forecast notice: "Day 3 is past the forecast", or null for a trip
   * with only one day, which says "This trip" — "Day 1" of a one-day drive is not how anyone talks.
   */
  readonly mapDay = computed(() => {
    const day = this.shownDay();
    return day && (this.itinerary()?.days.length ?? 0) > 1 ? day.ordinal + 1 : null;
  });

  /** The derived leg behind the selected day — where that day starts, ends and passes through. */
  readonly shownLeg = computed(() => {
    if (!this.itinerary()) return null;
    return this.travelDays().find((leg) => leg.ordinal === this.selectedDay()) ?? null;
  });

  /** "Day 2 · Thu 4 Oct · Albuquerque, NM → Phoenix, AZ" — what the surfaces below belong to. */
  readonly shownDayHeading = computed(() => {
    const leg = this.shownLeg();
    if (!leg) return '';
    const when = leg.travelDate ? dayLabel(leg.travelDate) : 'no date yet';
    return `Day ${leg.ordinal + 1} · ${when} · ${leg.origin.name} → ${leg.destination.name}`;
  });

  /**
   * Why the selected day has no route below it — never left as a blank space.
   *
   * The two reasons are different things and are said differently: past the horizon nobody HAS a
   * forecast (and will nearer the day), while an unroutable day is a failure confined to that day.
   */
  readonly shownDayNote = computed(() => {
    const day = this.shownDay();
    if (!day || day.plan) return null;
    const n = day.ordinal + 1;
    if (day.beyond_forecast) {
      return (
        `Day ${n} is past the ${FORECAST_HORIZON_DAYS}-day forecast — nobody has one for it yet. ` +
        `We'll have it closer to the day.`
      );
    }
    if (day.error) {
      return `We couldn't work out a route for day ${n}: ${day.error} The other days are unaffected.`;
    }
    return `There's no plan for day ${n}.`;
  });

  /** Session-only geolocation fix for the home map + origin prefill (ADR-0026); never persisted. */
  readonly userLocation = signal<{ latitude: number; longitude: number } | null>(null);

  /**
   * True while the shell is the desktop one-canvas layout: the map IS the page body (only the short
   * footer lies below, and the wheel still reaches it over the header or the trip panel), so a wheel
   * over the map can zoom it. Below the breakpoint the map is one block in a long scrolling page and
   * must let the wheel scroll past. MUST match the `@media (max-width: 959px)` stacking rule in this
   * component's styles.
   */
  readonly desktopLayout = signal(false);

  constructor() {
    // No matchMedia (the unit-test DOM): stay on the safe side — the wheel scrolls the page.
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(min-width: 960px)');
    const sync = () => this.desktopLayout.set(query.matches);
    sync();
    query.addEventListener('change', sync);
    inject(DestroyRef).onDestroy(() => query.removeEventListener('change', sync));
  }

  ngOnInit(): void {
    // Know the entitlement/usage up front so gating is correct (server-authoritative; F-002).
    void this.entitlement.refresh();
    // A trip queued from My Trips: prefill the fields (stops included — a saved multi-stop
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
      // A trip opened from My Trips shows what it was last planned as — one GET, no planning.
      // Only a real account has a stored trip to read; anything else plans as it always did.
      if (staged.savedTripId && this.auth.hasRealAccount()) {
        void this.openSaved(staged, staged.savedTripId);
        return;
      }
      void this.planStaged(staged);
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

  /** Plan a staged trip the ordinary way — fields are already filled. */
  private planStaged(staged: StagedTrip): Promise<void> {
    // A saved trip keeps the departure it was planned with, and that moment can already have
    // passed. Planning it verbatim forecast a drive that left last night: the forecast only starts
    // at the current hour, so every point matched nothing and the day read "past the 10-day
    // forecast" on a trip the traveller was looking at today. A departure that has gone is
    // replaced with the same default a fresh plan gets.
    if (staged.departureAt) {
      const saved = new Date(staged.departureAt);
      this.departureAt.set(
        saved.getTime() > Date.now() ? this.toLocalInput(saved) : this.defaultDeparture(),
      );
    }
    return this.submit();
  }

  /**
   * Open a trip from My Trips: render its stored result, and plan it only when there is nothing
   * usable to render.
   *
   * Re-planning on every open fetched a route, a forecast and a briefing just to look at a trip the
   * traveller had already seen — and on a phone and a laptop the same trip could read differently
   * depending on which one opened it last. The stored result is the same on every device.
   *
   * Exactly ONE network call on the happy path: the GET. Nothing is planned, briefed or saved —
   * saving here would re-store the result it just read, and could bump the trip's revision for
   * nothing. Every way this can fail except "the trip is gone" falls back to planning, because the
   * traveller asked to see their trip and planning it is how they always did.
   */
  private async openSaved(staged: StagedTrip, tripId: string): Promise<void> {
    this.opening.set(true);
    this.loading.set(true);
    let snapshot: DecodedSnapshot | null = null;
    try {
      snapshot = decodeTripSnapshot(await this.api.getTripSnapshot(tripId));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404 && e.code === 'trip_not_found') {
        // Deleted on another device while this list was on screen. Planning it would quietly
        // re-create it (the save is an upsert) — the one outcome worse than saying so.
        this.trips.notice.set(
          "That trip isn't in My Trips any more — it may have been deleted on another device.",
        );
        this.opening.set(false);
        this.loading.set(false);
        void this.router.navigate(['/saved']);
        return;
      }
      // `snapshot_not_found`, a network failure, an older server without the endpoint: plan it.
    }
    this.opening.set(false);
    this.loading.set(false);
    // More than two days old is not shown even dated: the traveller decided a forecast that old
    // should not be on screen at all, so it is replaced before anyone reads it.
    if (!snapshot || isSnapshotExpired(snapshot.plannedAt, Date.now())) {
      await this.planStaged(staged);
      return;
    }
    this.showSnapshot(snapshot, staged);
  }

  /**
   * Put a stored result on screen as if it had just been planned — map, timeline, day selection and
   * briefing — without planning anything.
   */
  private showSnapshot(snapshot: DecodedSnapshot, staged: StagedTrip): void {
    const origin = staged.origin;
    const destination = staged.destination;
    // The field shows the trip as SAVED, even a departure that has gone: the dated line says it has,
    // and Refresh is what moves it to now. Quietly rewriting it here would show a departure that
    // nothing on screen was planned for.
    const departure = new Date(staged.departureAt || snapshot.departureAt);
    this.departureAt.set(this.toLocalInput(departure));
    const waypoints = toWaypoints(this.stops());

    this.showResult(snapshot.result);
    if (snapshot.briefing) {
      // Shown WITHOUT its diff. A stored briefing that was itself a re-brief carries the "Updated"
      // badge of a comparison made when it was fetched; opening the snapshot asked the server
      // nothing, so announcing a change now would be a claim about a look that did not happen. The
      // facts/snapshot are still remembered as the baseline, so a Refresh diffs against what the
      // traveller is looking at.
      const shown = { ...snapshot.briefing, diff: null };
      this.showBriefing(
        shown,
        tripBaselineKey({ origin, destination, savedTripId: this.savedTrip?.id }),
      );
    }
    this.plannedContext.set({ origin, destination });
    this.plannedBase.set(new Date(snapshot.departureAt));
    this.departureOffset.set(0);
    this.plannedWaypointsKey = waypointsKey(waypoints);
    this.shownResult = {
      result: snapshot.result,
      briefing: snapshot.briefing,
      plannedAt: snapshot.plannedAt,
      departureAt: snapshot.departureAt,
      definitionKey: this.definitionKey(origin, destination, waypoints),
    };
    this.snapshotShown.set({ plannedAt: snapshot.plannedAt, departureAt: snapshot.departureAt });
  }

  /**
   * Refresh from the dated line: exactly what Get briefing does — including planning a departure
   * that has passed from now — and the auto-save that follows stores the fresh result.
   */
  refresh(): void {
    void this.submit();
  }

  /** The trip definition a result belongs to — see {@link SnapshotSource.definitionKey}. */
  private definitionKey(
    origin: PlaceValue,
    destination: PlaceValue,
    waypoints: WaypointModel[],
  ): string {
    return tripIdentityKey({ origin, destination, departureAt: this.departureAt(), waypoints });
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

  /**
   * Show another travel day. Selection only — nothing is re-fetched, because every day's plan
   * already arrived in the one `plan-itinerary` response.
   */
  onSelectDay(ordinal: number): void {
    if (ordinal === this.selectedDay()) return;
    this.selectedDay.set(ordinal);
    // The sample index is an index INTO the shown day's route; carrying it across would highlight
    // an unrelated point on a different drive.
    this.selected.set(null);
    // Same reason, one surface further out: the Explore results were ranked for the day (and the
    // corridor) that is no longer on screen.
    this.closeExplore();
  }

  private static readonly AUTO_SAVE_DEBOUNCE_MS = 2000;
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Planning a trip is what puts it in My Trips.
   *
   * It used to take a deliberate press of a star, and the star is why trips planned on the web were
   * missing from the traveller's phone: in thirty days of production logs the web client made ZERO
   * `POST /v1/trips`. What it wrote instead was a device-local "recent" — a list that looked synced
   * and never left the browser.
   *
   * `POST /v1/trips` is an UPSERT on (user, origin, destination), so re-planning the same trip
   * updates the one row rather than growing the list. The debounce is not for correctness then, but
   * for volume: the planner re-plans on every stop edit and every nudge of the departure scrubber.
   *
   * The pending timer is deliberately NOT cancelled when the page goes away. Opening My Trips
   * straight after planning is the most ordinary thing a traveller does here, and it is exactly the
   * navigation that would cancel the save of the trip they went to look for.
   */
  private scheduleAutoSave(): void {
    // Saving needs a real account; a guest's plan is theirs to look at and nothing is sent. Asked
    // BEFORE the timer, so a signed-out session never even has one pending.
    if (!this.auth.hasRealAccount()) return;
    if (this.autoSaveTimer !== null) clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => {
      this.autoSaveTimer = null;
      void this.autoSave();
    }, Plan.AUTO_SAVE_DEBOUNCE_MS);
  }

  /**
   * Background work the traveller did not ask for, so it fails INVISIBLY: no banner, no redirect to
   * sign-in, nothing on screen moved. Being bounced to /login in the middle of reading a briefing —
   * because a save they never requested came back 401 — would be the planner losing their trip to
   * a feature meant to keep it.
   */
  private async autoSave(): Promise<void> {
    const origin = this.origin();
    const destination = this.destination();
    if (!origin || !destination) return;
    // The whole trip, not the day on screen: a multi-day itinerary's totals are summed across its
    // days, and its stops + dwell + nights ride along so re-opening it re-plans the same trip.
    const totals = this.tripTotals();
    const waypoints = toWaypoints(this.stops());
    // Read with the rest of the save body, not after it returns: the revision the save hands back
    // describes the trip as it is being saved NOW, and the snapshot must be the result for that.
    const source = this.shownResult;
    const sourceMatches =
      source?.definitionKey === this.definitionKey(origin, destination, waypoints);
    try {
      const saved = await this.api.saveTrip({
        origin,
        destination,
        departure_at: new Date(this.departureAt()).toISOString(),
        distance_meters: totals.distanceMeters ?? 0,
        duration_seconds: totals.durationSeconds ?? 0,
        // Same reasoning as the manual save this replaced: `worst_severity` is required, and
        // 'clear' would persist an affirmative all-clear we do not have.
        worst_severity: totals.worstSeverity ?? SEVERITY_FALLBACK,
        waypoints,
      });
      // Only when the result on screen was planned for exactly what was just saved. When the form
      // has moved on (a re-plan in flight, an endpoint typed but not submitted) the payload would be
      // stored under a revision it does not describe; the re-plan that follows saves again.
      const stored = source && sourceMatches ? this.storeSnapshot(saved, source) : null;
      // So My Trips is current the moment it is opened — including the id and legs the server just
      // assigned, which a locally-appended row would not have.
      await Promise.all([stored, this.trips.refresh()]);
    } catch {
      // Deliberately silent, including the 401. The trip is still on screen and still plannable.
    }
  }

  /**
   * Store the result as the trip's snapshot, pinned to the revision the save just returned.
   *
   * Silent for the same reasons the save is. A 409 `trip_changed` means another device changed the
   * trip after this save — this result describes stops the trip no longer has, so it is dropped, not
   * retried (a retry with a fresher revision would store it under a definition it was not planned
   * for). A 413 is a trip too big to keep; it simply opens by planning, as every trip used to.
   */
  private async storeSnapshot(saved: SavedTripModel, source: SnapshotSource): Promise<void> {
    // An older server returns no revision, and has no snapshot endpoint to send one to.
    if (!saved.id || !saved.revision) return;
    try {
      await this.api.saveTripSnapshot(saved.id, buildSnapshotRequest(source, saved.revision));
    } catch {
      // Deliberately silent — see above.
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
    const raw = Number((event.target as HTMLInputElement).value);
    const step = Math.abs(raw) <= 60 ? 5 : 15;
    const snapped = Math.round(raw / step) * step;
    this.departureOffset.set(
      Math.min(Math.max(snapped, this.earliestOffset()), this.LATEST_OFFSET),
    );
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
   * Done in the stops editor: the whole set of edits arrives at once and goes through the same
   * path a single edit always has, so it re-plans (and then auto-saves) only if the planned
   * waypoints actually changed — opening the editor to look is not an edit.
   */
  onStopsEditorDone(next: StopDraft[]): void {
    this.stopsEditorOpen.set(false);
    this.onStopsChange(next);
  }

  /**
   * F-006: map long-press drops a stop at the pressed location while a trip is planned or being
   * planned (and under the cap). The name comes from reverse geocoding (fast; a failure falls
   * back to a "Stop N (lat, lon)" label), then the edit flows through {@link onStopsChange}.
   */
  async addStopFromMap(loc: { latitude: number; longitude: number }): Promise<void> {
    if (this.stops().length >= MAX_STOPS) return;
    if (!this.planned() && !this.loading() && !this.canSubmit()) return;
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

  /**
   * The right planning call for this trip: `/plan-itinerary` once the stops make it more than one
   * travel day, `/plan` otherwise.
   *
   * A one-day trip is not merely allowed to keep using `/plan` — it MUST, and with no extra call.
   * It is the overwhelmingly common trip, `/plan-itinerary` would answer it with a single day
   * wrapped in an envelope, and paying a second round trip (or a bigger one) to learn what the
   * derived legs already say would be a tax on every ordinary drive.
   *
   * `multiDay` is asked ONCE per submit (from the same local derivation the day list is drawn from)
   * and handed to this and to {@link briefingRequestFor} together, rather than re-derived inside
   * each. The plan and the briefing must be about the same kind of trip: a one-day plan underneath
   * a whole-trip briefing would put the contradiction back with both halves believing they were
   * right, and a single answer reaching both is the only way that cannot happen.
   */
  private planRequestFor(args: {
    origin: PlaceValue;
    destination: PlaceValue;
    departureAt: string;
    waypoints: WaypointModel[];
    multiDay: boolean;
  }): Promise<PlanTripResponse | PlanItineraryResponse> {
    if (args.multiDay) {
      return this.api.planItinerary(buildItineraryRequest({ ...args, timezone: localTimezone() }));
    }
    return this.api.planTrip(buildPlanRequest(args));
  }

  /**
   * The right briefing call for this trip: `/v1/briefings/itinerary` once the stops make it more
   * than one travel day, `/v1/briefings` otherwise.
   *
   * The single-day path is untouched, down to the body it sends: the ordinary drive is the common
   * case, it is the one the re-brief diff (F-012) is built around, and the itinerary endpoint would
   * answer it with a one-row rollup and no diff at all.
   *
   * Each path sends its OWN baseline and never the other's: `previous_facts` (+ `trip_id`, whose
   * server-stored baseline supersedes it) on the single-day call, `previous_snapshot` on the
   * itinerary call. They are not interchangeable — one is a day's facts, the other is three fields
   * per travel day — and the itinerary endpoint takes no `trip_id`, so its baseline is only ever
   * the one this session remembered.
   */
  private briefingRequestFor(args: {
    origin: PlaceValue;
    destination: PlaceValue;
    departureAt: string;
    waypoints: WaypointModel[];
    units: 'imperial' | 'metric';
    previousFacts?: BriefingFactsModel;
    previousSnapshot?: DaySnapshotModel[];
    savedTripId?: string;
    multiDay: boolean;
  }): Promise<BriefingResponse | ItineraryBriefingResponse> {
    if (args.multiDay) {
      return this.api.createItineraryBriefing(
        buildItineraryBriefingRequest({ ...args, timezone: localTimezone() }),
      );
    }
    return this.api.createBriefing(buildBriefingRequest(args));
  }

  /**
   * Show a briefing, whichever kind came back — told apart by the shape the server sent, never by
   * re-deriving the day count here. Setting one signal always clears the other.
   *
   * Either response is remembered as the next re-brief baseline, in the form its OWN endpoint takes
   * back: the single-day `facts`, or the whole-trip `snapshot`. The itinerary `snapshot` comes back
   * on every briefing including the first — that first one is what gives the second look something
   * to compare against, so it is stored even though this response showed no badge.
   */
  private showBriefing(
    result: BriefingResponse | ItineraryBriefingResponse,
    baselineKey: string,
  ): void {
    if ('rollup' in result) {
      this.briefing.set(null);
      this.tripBriefing.set(result);
      this.briefingMemory.rememberSnapshot(baselineKey, result.snapshot ?? []);
      return;
    }
    this.tripBriefing.set(null);
    this.briefing.set(result);
    this.briefingMemory.remember(baselineKey, result.facts);
  }

  private async replan(opts: { refreshBriefing?: boolean } = {}): Promise<void> {
    const base = this.plannedBase();
    const ctx = this.plannedContext();
    if (!base || !ctx) return;
    const departureAt = new Date(base.getTime() + this.departureOffset() * 60_000).toISOString();
    // A stored result can be for a departure that has gone. Editing it re-plans, and re-planning a
    // departure behind the current hour gives a route with no forecast — so it goes through the
    // same path Refresh does, which plans it from now.
    if (this.snapshotShown() && Date.parse(departureAt) < Date.now()) {
      await this.submit();
      return;
    }
    const waypoints = toWaypoints(this.stops());
    const definitionKey = this.definitionKey(ctx.origin, ctx.destination, waypoints);
    // F-012: previous_facts now ride along across a PLAN edit of the same trip — the departure
    // scrubber and stop edits are exactly the cases worth diffing. The identity key still governs
    // whether the SHOWN briefing is stale (ADR-0031 §3); the baseline key governs what to diff
    // against. A genuinely different trip still matches nothing.
    const savedTripId = this.savedTripIdFor(ctx.origin, ctx.destination);
    const baselineKey = tripBaselineKey({ ...ctx, savedTripId });
    const previousFacts = this.briefingMemory.previousFactsFor(baselineKey);
    // The whole-trip baseline, under the same key: a re-plan of the same trip is exactly the case
    // worth diffing, and a key that matched nothing is a trip that was never briefed here.
    const previousSnapshot = this.briefingMemory.previousSnapshotFor(baselineKey);
    // Asked before either request goes out, so the plan and the briefing are about the same trip.
    const multiDay = this.travelDays().length > 1;
    this.replanning.set(true);
    try {
      const [result, briefing] = await Promise.all([
        this.planRequestFor({ ...ctx, departureAt, waypoints, multiDay }),
        opts.refreshBriefing
          ? this.briefingRequestFor({
              ...ctx,
              departureAt,
              waypoints,
              units: this.settings.units(),
              previousFacts,
              previousSnapshot,
              savedTripId,
              multiDay,
            })
          : Promise.resolve(null),
      ]);
      this.showResult(result, { keepDay: true });
      if (briefing) this.showBriefing(briefing, baselineKey);
      this.plannedWaypointsKey = waypointsKey(waypoints);
      // Fresh now, so the date goes. A briefing that was not re-requested (the scrubber) stays the
      // one already on screen, and is stored as such.
      this.shownResult = {
        result,
        briefing: briefing ?? this.shownResult?.briefing ?? null,
        plannedAt: new Date().toISOString(),
        departureAt,
        definitionKey,
      };
      this.snapshotShown.set(null);
      // An edit is still a plan of this trip, and the saved row should be the trip as it now
      // stands. This is the path the debounce exists for: the departure scrubber re-plans on
      // every nudge.
      this.scheduleAutoSave();
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

  /**
   * Where the forecast stops and history begins.
   *
   * Both now live in `core/forecast-horizon`, because the per-day travel list and the trip briefing
   * ask the same question of every day of a month-long trip and the same date must not be a
   * forecast in one place and history in another. Re-exported as statics so the existing call
   * sites and specs are unchanged.
   *
   * The picker is open-ended again: Phase 0 capped it because a later date produced a trip whose
   * every point showed the last available forecast hour as that day's weather, and that is no
   * longer what happens.
   */
  static readonly FORECAST_HORIZON_DAYS = FORECAST_HORIZON_DAYS;
  /** The same constant for the template, which cannot read statics. */
  readonly horizonDays = FORECAST_HORIZON_DAYS;
  static readonly tierFor = tierFor;
  static readonly isoDay = isoDay;

  /** True when any sampled point of the SHOWN day is further out than the forecast reaches. */
  readonly hasBeyondForecast = computed(() =>
    (this.shownPlan()?.samples ?? []).some((s) => s.beyond_forecast === true),
  );

  /**
   * The whole trip's figures, however it was planned — what gets saved and recorded.
   *
   * A multi-day trip adds up the days that HAVE plans; days past the horizon or with a failed route
   * contribute nothing rather than a zero pretending to be a measurement, so the total is honestly
   * a floor. The worst severity is the server's own across the whole itinerary.
   */
  private tripTotals(): {
    distanceMeters?: number;
    durationSeconds?: number;
    worstSeverity?: string;
  } {
    const itinerary = this.itinerary();
    if (itinerary) {
      const plans = itinerary.days.flatMap((d) => (d.plan ? [d.plan] : []));
      return {
        distanceMeters: plans.reduce((sum, p) => sum + p.distance_meters, 0),
        durationSeconds: plans.reduce((sum, p) => sum + p.duration_seconds, 0),
        worstSeverity: itinerary.worst_severity ?? undefined,
      };
    }
    const p = this.plan();
    return {
      distanceMeters: p?.distance_meters,
      durationSeconds: p?.duration_seconds,
      worstSeverity: p?.worst_severity,
    };
  }

  /**
   * Show a planning result, whichever kind came back.
   *
   * The two results are told apart by the shape the server sent (`days`), not by re-deriving the
   * leg count here — a client that decided for itself could show a one-day plan while believing it
   * asked for an itinerary, which is the disagreement this change exists to end. Setting one signal
   * always clears the other.
   */
  private showResult(
    result: PlanTripResponse | PlanItineraryResponse,
    opts: { keepDay?: boolean } = {},
  ): void {
    if ('days' in result) {
      this.plan.set(null);
      this.itinerary.set(result);
      // A re-plan keeps the day the traveller was reading, as long as it is still a day of this
      // trip; a fresh submit opens on the first day there is something to show for. Opening on a
      // blank day would read as the whole plan having failed.
      const keep = opts.keepDay && result.days.some((d) => d.ordinal === this.selectedDay());
      if (!keep) this.selectedDay.set(Plan.firstShowableDay(result));
    } else {
      this.itinerary.set(null);
      this.plan.set(result);
      this.selectedDay.set(0);
    }
    this.selected.set(null);
  }

  private static firstShowableDay(itinerary: PlanItineraryResponse): number {
    const day = itinerary.days.find((d) => d.plan) ?? itinerary.days[0];
    return day?.ordinal ?? 0;
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
    this.itinerary.set(null);
    this.outlook.set(null);
    this.briefing.set(null);
    this.tripBriefing.set(null);
    this.selected.set(null);
    this.departureOffset.set(0);
    // Whatever was on screen is gone, stored snapshot included — nothing is left to date or store.
    this.shownResult = null;
    this.snapshotShown.set(null);
    // A new plan is a new trip — any open Explore session (results, pins) is for the old one.
    this.closeExplore();

    // A departure that has already passed is planned from now. The field's default is "an hour after
    // the page loaded", so a tab left open goes stale on its own — and a forecast only starts at the
    // current hour, so a departure behind it gives the first day a route with no weather at all.
    // Shown in the field, not just corrected on the wire, so the trip on screen is the one planned.
    if (new Date(this.departureAt()).getTime() < Date.now()) {
      this.departureAt.set(this.toLocalInput(new Date()));
    }
    const base = new Date(this.departureAt());
    const departureAt = base.toISOString();
    // F-006: the plan AND the briefing carry the same waypoints (the briefing narrates the stops).
    const waypoints = toWaypoints(this.stops());

    // Past the forecast, the honest answer is a different one — and a different call, returning a
    // different shape, so nothing here can render history as a forecast.
    if (Plan.tierFor(base) === 'outlook') {
      try {
        const outlook = await this.api.tripOutlook({
          origin: { name: origin.name, latitude: origin.latitude, longitude: origin.longitude },
          destination: {
            name: destination.name,
            latitude: destination.latitude,
            longitude: destination.longitude,
          },
          waypoints,
          travel_date: Plan.isoDay(base),
        });
        this.outlook.set(outlook);
        this.plannedContext.set({ origin, destination });
      } catch (e) {
        // Same three outcomes as a forecast plan: the auth wall, the paywall, or a real error.
        // An outlook IS planning, so it sits behind the same gate.
        if (e instanceof AccountRequiredError) {
          this.router.navigate(['/login']);
        } else if (e instanceof PaywallError) {
          this.analytics.capture('route_blocked_free_cap', { trigger: e.payload.reason });
          this.paywall.show(e.payload);
        } else {
          this.error.set(this.describe(e));
        }
      } finally {
        this.loading.set(false);
      }
      return;
    }
    // F-012 re-brief: the prior facts for this TRIP (endpoints), whatever plan version they were
    // generated for — so re-submitting with a moved departure still produces a labelled diff.
    const savedTripId = this.savedTripIdFor(origin, destination);
    const baselineKey = tripBaselineKey({ origin, destination, savedTripId });
    const previousFacts = this.briefingMemory.previousFactsFor(baselineKey);
    // The whole-trip half of the same thing (`snapshot` → `previous_snapshot`). Same key, so a
    // snapshot can only ever go back to the trip it was taken from; re-target either endpoint and
    // the key changes and nothing is sent, which is a first look and reads as one.
    const previousSnapshot = this.briefingMemory.previousSnapshotFor(baselineKey);
    // One answer, both requests: this trip is either a sequence of dated days or a single drive,
    // and the plan and the briefing have to be about the same one.
    const multiDay = this.travelDays().length > 1;
    const definitionKey = this.definitionKey(origin, destination, waypoints);
    // When the PLAN arrived, which is what the forecast's age is measured from — not when the
    // briefing beside it did.
    let plannedAt = '';
    try {
      const [result, briefing] = await Promise.all([
        this.planRequestFor({ origin, destination, departureAt, waypoints, multiDay }).then((r) => {
          plannedAt = new Date().toISOString();
          return r;
        }),
        this.briefingRequestFor({
          origin,
          destination,
          departureAt,
          waypoints,
          units: this.settings.units(),
          previousFacts,
          previousSnapshot,
          savedTripId,
          multiDay,
        }),
      ]);
      this.showResult(result);
      const totals = this.tripTotals();
      // ADR-0037 activation event, matching the iOS `trip_planned` (same name, same `distance_mi`
      // property). Whole miles only — never the endpoints. A multi-day trip reports the whole
      // trip's distance, not the day that happens to be on screen.
      this.analytics.capture('trip_planned', {
        distance_mi: Math.round((totals.distanceMeters ?? 0) / 1609.344),
      });
      this.showBriefing(briefing, baselineKey);
      this.shownResult = {
        result,
        briefing,
        plannedAt,
        departureAt,
        definitionKey,
      };
      this.plannedContext.set({ origin, destination });
      this.plannedBase.set(base);
      this.plannedWaypointsKey = waypointsKey(waypoints);
      // My Trips: every trip you plan, on every device. Covers both shapes — `showResult` has
      // already taken whichever of the two the server sent.
      this.scheduleAutoSave();
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
