import { Component, computed, input, output } from '@angular/core';

import { type DerivedLeg, deriveLegs, totalDays } from '../../core/itinerary';
import { IconComponent } from '../../ui/icon';
import type { PlaceValue } from './place-field';
import {
  type StopDraft,
  formatNights,
  normalizeNights,
  toItineraryStops,
  toWaypoints,
} from './waypoints';

/**
 * When a stop with nights says nothing about the next morning, the traveller leaves at 08:00 local.
 *
 * That is the SERVER's rule, not a client guess: the planner shows it and never sends it. A stop
 * whose time was defaulted goes out without `departure_time` (see `toWaypoints`), so if this
 * constant and the server's ever differed, the day would still be planned at the server's hour —
 * the only way the label could be wrong is by being out of date, never by planning a different trip.
 */
export const DEFAULT_STOP_DEPARTURE = '08:00';

/** "8 AM", "9:30 AM", "12 PM" from a wire `HH:MM` (or `HH:MM:SS`). Unparseable text is shown as is. */
export function formatClock(time: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return time;
  const hours = Number(match[1]);
  const minutes = match[2];
  if (hours > 23 || Number(minutes) > 59) return time;
  const suffix = hours < 12 ? 'AM' : 'PM';
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === '00' ? `${h12} ${suffix}` : `${h12}:${minutes} ${suffix}`;
}

/**
 * The one chip a stop row carries for its stay: "Pass", "30 min", "2 nights · 8 AM".
 *
 * One chip rather than a nights control beside a time control: with the two side by side a phone
 * row truncated the time to "An…", and a trip of six stops became a wall of half-read pickers.
 */
export function stayChipLabel(
  stop: Pick<StopDraft, 'dwellMinutes' | 'nights' | 'departureTime'>,
): string {
  const nights = normalizeNights(stop.nights);
  if (nights > 0) {
    return `${formatNights(nights)} · ${formatClock(stop.departureTime ?? DEFAULT_STOP_DEPARTURE)}`;
  }
  return stop.dwellMinutes > 0 ? `${stop.dwellMinutes} min` : 'Pass';
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * "2 stops · 8 days" — every stop on the trip, folded into the one line the planner shows.
 *
 * The day count is `totalDays(deriveLegs(...))`, the derivation pinned to the shared vectors, and
 * NOT a count of nights plus one written here: a second formula is how the planner once dated
 * every leg a day later than the itinerary did. Endpoints are irrelevant to how many days a trip
 * spans, so it is derived without them and reads correctly before either field is filled.
 *
 * Counts only stops with a place. A row still being typed plans nothing, and counting it would
 * promise a stop the trip does not have.
 */
export function stopsSummaryLabel(stops: readonly StopDraft[]): string {
  const waypoints = toWaypoints(stops);
  if (!waypoints.length) return '+ Add stops';
  const legs = deriveLegs<PlaceValue | null>({
    origin: null,
    destination: null,
    stops: toItineraryStops(waypoints),
  });
  return `${plural(waypoints.length, 'stop')} · ${plural(totalDays(legs), 'day')}`;
}

/**
 * The travel days a trip's stops imply, from the planner's own fields.
 *
 * Shared by the planner (which plans from them) and the stops editor (which lists them) so the
 * list a traveller edits against is the same derivation the request is decided by.
 *
 * `datetime-local` is already the user's LOCAL wall clock in `YYYY-MM-DDTHH:MM` — split rather than
 * round-tripped through Date, which would re-interpret it in UTC and shift the day west of
 * Greenwich. An empty field derives undated days rather than today's.
 */
export function deriveTripDays(args: {
  origin: PlaceValue | null;
  destination: PlaceValue | null;
  stops: readonly StopDraft[];
  departureAt: string;
}): DerivedLeg<PlaceValue>[] {
  const { origin, destination } = args;
  // A day from an unnamed place to an unnamed place is not something to show anyone.
  if (!origin || !destination) return [];
  const [day, time] = args.departureAt.split('T');
  return deriveLegs<PlaceValue>({
    origin,
    destination,
    stops: toItineraryStops(toWaypoints(args.stops)),
    departureDate: day || null,
    departureTime: time || null,
  });
}

/**
 * The single line between origin and destination that stands in for every stop on the trip.
 *
 * The planner used to list each stop inline, with its own controls, and then list the same stops
 * again as days. Two stops on a phone pushed the map to a sliver; six made the planner a form. Now
 * the trip's shape is one tappable line, and the stops live in their own editor.
 */
@Component({
  selector: 'app-stops-summary',
  imports: [IconComponent],
  template: `
    <button
      class="line"
      type="button"
      [class.empty]="!count()"
      (click)="edit.emit()"
      [attr.aria-label]="count() ? label() + ', edit stops' : 'Add stops'"
    >
      <span class="text">{{ label() }}</span>
      @if (count()) {
        <span class="edit">Edit <app-icon name="chevron-right" [size]="14" /></span>
      }
    </button>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      /* Text starts where the place names do (50px) and stops short of the swap button's column. */
      .line {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        min-height: 44px;
        padding: 8px 56px 8px 50px;
        border: none;
        background: transparent;
        font: 700 14px var(--font-body);
        color: var(--text);
        text-align: left;
        cursor: pointer;
      }
      .line.empty {
        color: var(--link);
      }
      .text {
        flex: 1;
        min-width: 0;
        font-variant-numeric: tabular-nums;
      }
      .edit {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        color: var(--link);
        font-size: 13px;
      }
      .line:hover .edit,
      .line.empty:hover {
        color: var(--link-hover);
      }
    `,
  ],
})
export class StopsSummary {
  readonly stops = input.required<readonly StopDraft[]>();
  readonly edit = output<void>();

  readonly count = computed(() => toWaypoints(this.stops()).length);
  readonly label = computed(() => stopsSummaryLabel(this.stops()));
}
