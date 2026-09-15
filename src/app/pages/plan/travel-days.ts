import { Component, computed, input, output } from '@angular/core';
import type { PlannedDayModel } from '@road-travel/sdk';

import { FORECAST_HORIZON_DAYS, dayLabel } from '../../core/forecast-horizon';
import { type DerivedLeg, totalDays, totalNights } from '../../core/itinerary';
import type { PlaceValue } from './place-field';
import {
  SEVERITY_COLOR,
  SEVERITY_LABEL,
  UNKNOWN_COLOR,
  UNKNOWN_LABEL,
  formatDistance,
  formatDuration,
  severityOrFallback,
} from './severity';
import { DEFAULT_STOP_DEPARTURE, formatClock } from './stops-summary';
import { formatNights } from './waypoints';

/**
 * The travel days the stops above add up to, each carrying ITS OWN forecast.
 *
 * The dates are read-only on purpose. Every other list of days in the product is editable — the
 * saved trip's itinerary screen lets you re-date a leg — but here the days are a RESULT: the
 * traveller said "three nights in Albuquerque", and this is what that means for when they drive.
 * Letting a date be typed here would make the two statements able to contradict each other, and the
 * stops are the one the traveller actually meant.
 *
 * So the days carry no date inputs, and the caption says where they came from. Change a stop's
 * nights and the whole list moves; that is the thing this surface is for showing.
 *
 * The weather on each row comes from `/v1/trips/plan-itinerary` — one plan per day, made at that
 * day's own departure instant — and is matched to a leg BY ORDINAL rather than by position, so a
 * row only ever shows the conditions the server computed for that same day. A leg the server has no
 * day for shows no conditions at all: an empty row is honest, and borrowing the neighbouring day's
 * forecast is the exact substitution this whole surface exists to prevent.
 */
@Component({
  selector: 'app-travel-days',
  template: `
    <p class="caption">{{ summary() }} — from your stops. Change a stop's nights and these move.</p>
    <ol class="days">
      @for (leg of legs(); track leg.ordinal) {
        <li class="day" [class.sel]="selectable() && leg.ordinal === selectedDay()">
          <!-- A button rather than a div-with-a-click: picking which day the timeline and map below
               are showing IS an action, and it should be reachable from the keyboard like one. It
               is genuinely disabled until a plan exists, because before that there is nothing for a
               click to switch to — a control that looks live and does nothing is worse than one
               that says it is not ready. -->
          <button
            class="body"
            type="button"
            [disabled]="!selectable()"
            [attr.aria-pressed]="selectable() ? leg.ordinal === selectedDay() : null"
            (click)="selectedDayChange.emit(leg.ordinal)"
          >
            <div class="head">
              <span class="num">Day {{ leg.ordinal + 1 }}</span>
              @if (leg.travelDate) {
                <span class="date">{{ date(leg) }}</span>
              } @else {
                <!-- No departure date yet. An undated day is a real answer; a guessed date would
                     decide which weather this drive is matched against. -->
                <span class="date undated">No date yet</span>
              }
              <span class="leaves">{{ leaves(leg) }}</span>
            </div>
            <p class="route">
              {{ leg.origin.name }} <span class="arrow">→</span> {{ leg.destination.name }}
            </p>
            @if (leg.waypoints.length) {
              <p class="via">via {{ via(leg) }}</p>
            }

            @if (dayFor(leg.ordinal); as day) {
              @if (day.plan; as plan) {
                <p class="forecast">
                  <span class="sev" [style.background]="color(plan.worst_severity)"></span>
                  <span class="sev-label">{{ label(plan.worst_severity) }}</span>
                  <span class="drive"
                    >{{ distance(plan.distance_meters) }} ·
                    {{ duration(plan.duration_seconds) }}</span
                  >
                </p>
              } @else if (day.beyond_forecast) {
                <!-- NOT a failure, and never drawn as one. Grey like every other "nobody knows
                     yet" on this screen, and the same sentence the timeline's beyond-horizon note
                     uses — one trip should not describe the same fact two ways. -->
                <p class="forecast">
                  <span class="sev" [style.background]="UNKNOWN_COLOR"></span>
                  <span class="sev-label muted">{{ UNKNOWN_LABEL }}</span>
                </p>
                <p class="beyond">
                  Past the {{ HORIZON_DAYS }}-day forecast. We'll have it closer to the day.
                </p>
              } @else if (day.error) {
                <!-- ONE day's route failed. The sentence says which day and stops there: the other
                     days have real plans, and wording this as "we couldn't plan your trip" would
                     throw away every forecast that did arrive. -->
                <p class="day-error">
                  <span>We couldn't work out a route for this day: {{ day.error }}</span>
                  <span class="aside">The other days are unaffected.</span>
                </p>
              }
            }

            @if (isLongDay(leg.ordinal)) {
              <!-- Reported, never acted on. Where a break belongs is the traveller's call, and this
                   must not hint that the app will insert one: adding a night would re-date every
                   later day around a stop nobody chose. -->
              <p class="long">Over {{ LONG_DAY_HOURS }} hours at the wheel — a long day.</p>
            }

            @if (leg.nightsAtDestination > 0) {
              <p class="stay">{{ nights(leg) }} in {{ leg.destination.name }}, then on</p>
            }
          </button>
        </li>
      }
    </ol>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .caption {
        margin: 0 0 8px;
        font-size: 12px;
        font-weight: 600;
        color: var(--muted);
      }
      .days {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .day {
        border-radius: var(--radius-sm);
        background: var(--surface);
        box-shadow: var(--shadow-sm);
      }
      /* The selected day is the one the timeline and map below are showing. */
      .day.sel {
        outline: 2px solid var(--accent);
        outline-offset: -2px;
      }
      /* The button is the whole card. Stripped back to the block it replaced so that being
         focusable costs the layout nothing — and a disabled one keeps full-strength ink, because
         the card is still the itinerary, not a greyed-out control. */
      .body {
        display: block;
        width: 100%;
        margin: 0;
        padding: 10px 12px;
        border: none;
        border-radius: inherit;
        background: none;
        font: inherit;
        color: inherit;
        text-align: left;
        cursor: pointer;
      }
      .body:disabled {
        cursor: default;
        opacity: 1;
      }
      .head {
        display: flex;
        align-items: baseline;
        gap: 8px;
      }
      .num {
        font: 800 11px var(--font-body);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--muted);
      }
      .date {
        font: 700 13px var(--font-body);
        color: var(--text);
      }
      .date.undated {
        color: var(--muted);
        font-weight: 600;
      }
      .leaves {
        margin-left: auto;
        font-size: 12px;
        color: var(--muted);
        white-space: nowrap;
      }
      .route {
        margin: 4px 0 0;
        font: 600 14px var(--font-body);
        color: var(--text);
      }
      .arrow {
        color: var(--muted);
      }
      .via,
      .stay {
        margin: 3px 0 0;
        font-size: 12px;
        color: var(--muted);
      }
      .forecast {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 6px 0 0;
        font-size: 12px;
      }
      .sev {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        flex: 0 0 auto;
      }
      .sev-label {
        font-weight: 700;
        color: var(--text);
      }
      .sev-label.muted {
        font-weight: 600;
        color: var(--muted);
      }
      .drive {
        margin-left: auto;
        color: var(--muted);
        white-space: nowrap;
      }
      .beyond,
      .long {
        margin: 4px 0 0;
        font-size: 12px;
        color: var(--text-secondary, #82796a);
      }
      /* One day's route failing is not the trip's error state, so it does not borrow the page's
         error styling — that banner means "nothing was planned", which is not what happened. */
      .day-error {
        display: grid;
        gap: 3px;
        margin: 4px 0 0;
        padding: 7px 9px;
        border-radius: 9px;
        background: var(--well, #f9f4ed);
        font-size: 12px;
        font-weight: 600;
        color: var(--text-secondary, #82796a);
      }
      .day-error .aside {
        font-weight: 500;
      }
    `,
  ],
})
export class TravelDays {
  /** The derived days — never edited here, so this is a plain input rather than a model. */
  readonly legs = input.required<DerivedLeg<PlaceValue>[]>();

  /**
   * The server's per-day plans, once the trip has been planned. Null while the traveller is still
   * typing: the day list appears before anything is planned, and it says nothing about weather then
   * rather than showing a row of blanks that read as "clear".
   */
  readonly days = input<readonly PlannedDayModel[] | null>(null);

  /** The days the server measured as more than one day's driving (`long_day_ordinals`). */
  readonly longDayOrdinals = input<readonly number[]>([]);

  readonly units = input<'imperial' | 'metric'>('imperial');

  /** Which day the timeline and map below are currently showing. */
  readonly selectedDay = input<number | null>(null);
  readonly selectedDayChange = output<number>();

  /** Mirrors the server's `LONG_LEG_HOURS`; quoted, not re-derived from a duration here. */
  readonly LONG_DAY_HOURS = 10;
  readonly HORIZON_DAYS = FORECAST_HORIZON_DAYS;
  readonly UNKNOWN_COLOR = UNKNOWN_COLOR;
  readonly UNKNOWN_LABEL = UNKNOWN_LABEL;

  /** A day is pickable only once there are per-day plans to pick between. */
  readonly selectable = computed(() => (this.days()?.length ?? 0) > 0);

  /** "3 drives across 8 days, 5 nights" — what makes the list legible as an itinerary. */
  readonly summary = computed(() => {
    const legs = this.legs();
    const drives = `${legs.length} ${legs.length === 1 ? 'drive' : 'drives'}`;
    const nights = totalNights(legs);
    if (nights === 0) return `${drives} in a day`;
    return `${drives} across ${totalDays(legs)} days, ${formatNights(nights)}`;
  });

  /**
   * The planned day for a leg, matched by ORDINAL.
   *
   * Not by array position: a response that came back with fewer days than the stops now imply (the
   * user edited a stop while the request was in flight) would otherwise slide every forecast one
   * day earlier — the same off-by-one substitution, just harder to see.
   */
  dayFor(ordinal: number): PlannedDayModel | null {
    return this.days()?.find((d) => d.ordinal === ordinal) ?? null;
  }

  isLongDay(ordinal: number): boolean {
    return this.longDayOrdinals().includes(ordinal);
  }

  /** The day's worst condition, through the shared fail-safe — never a raw cast to Severity. */
  color(severity: string | null | undefined): string {
    return SEVERITY_COLOR[severityOrFallback(severity)];
  }

  label(severity: string | null | undefined): string {
    return SEVERITY_LABEL[severityOrFallback(severity)];
  }

  distance(meters: number): string {
    return formatDistance(meters, this.units());
  }

  /** Driving time only — the server's `duration_seconds`, dwell excluded, as everywhere else. */
  duration(seconds: number): string {
    return formatDuration(seconds);
  }

  date(leg: DerivedLeg<PlaceValue>): string {
    return leg.travelDate ? dayLabel(leg.travelDate) : '';
  }

  /**
   * "leaves 9:30 AM". A day that leaves from an overnight stop with no chosen time says the
   * server's 08:00 — the hour it is planned at — because the stop's chip in the editor says so too,
   * and "sometime that day" beneath "2 nights · 8 AM" would be the same stop described two ways.
   *
   * The first day's time is the trip's own departure field; blank there is still spelled out
   * rather than left empty, since no default applies to it.
   */
  leaves(leg: DerivedLeg<PlaceValue>): string {
    const time = leg.departureTime ?? (leg.ordinal > 0 ? DEFAULT_STOP_DEPARTURE : null);
    return time ? `leaves ${formatClock(time)}` : 'sometime that day';
  }

  via(leg: DerivedLeg<PlaceValue>): string {
    return leg.waypoints.map((w) => w.name).join(', ');
  }

  nights(leg: DerivedLeg<PlaceValue>): string {
    return formatNights(leg.nightsAtDestination);
  }
}
