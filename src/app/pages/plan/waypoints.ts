import type {
  BriefingFactsModel,
  BriefingRequest,
  PlanItineraryRequest,
  PlanTripRequest,
  WaypointModel,
} from '@road-travel/sdk';

import type { ItineraryStop } from '../../core/itinerary';
import type { PlaceValue } from './place-field';

/**
 * F-006 multi-stop helpers: the draft stop rows the planner edits, and the pure request-building
 * that turns them into the contract's `waypoints` (thin client — the server routes, samples and
 * shifts every ETA by dwell; ADR-0011). Kept framework-free so the composition is unit-testable.
 */

/** The product's dwell presets (minutes). Anything else is rejected server-side (422). */
export type DwellMinutes = 0 | 15 | 30 | 45 | 60;
export const DWELL_PRESETS: readonly DwellMinutes[] = [0, 15, 30, 45, 60];

/** Mirrors the contract's `nights` maximum — a stop longer than this is a second trip. */
export const MAX_NIGHTS = 120;

/** Product cap — mirrors the server's `MAX_WAYPOINTS` (a 4th stop is a 422; ADR-0031). */
/**
 * Mirrors the server's MAX_WAYPOINTS. This is the Mapbox Directions ceiling — 25 coordinates per
 * request, two of which are the origin and destination — not a product knob, so raising it past
 * 23 means stitching several Directions calls together.
 */
export const MAX_STOPS = 23;

/** One editable stop row: the place may still be empty (mid-typing) — only complete rows plan. */
export interface StopDraft {
  /** Stable row identity for tracking through reorders. */
  id: number;
  place: PlaceValue | null;
  dwellMinutes: DwellMinutes;
  /** Nights spent here. 0 is a pass-through; 1+ ends a travel day and starts the next one. */
  nights: number;
  /** `HH:MM` set off time for the morning after the stay; null = "sometime that day". */
  departureTime: string | null;
}

let stopSeq = 0;
export function newStop(
  place: PlaceValue | null = null,
  dwellMinutes: DwellMinutes = 0,
  nights = 0,
  departureTime: string | null = null,
): StopDraft {
  return { id: ++stopSeq, place, dwellMinutes, nights: normalizeNights(nights), departureTime };
}

/** Coerce a server/storage dwell value onto the preset scale (defensive; server validates too). */
export function normalizeDwell(minutes: number | undefined | null): DwellMinutes {
  return (DWELL_PRESETS as readonly number[]).includes(minutes ?? 0)
    ? ((minutes ?? 0) as DwellMinutes)
    : 0;
}

/**
 * Coerce a nights value into the contract's range. A number input hands back `null` mid-edit and
 * happily accepts `2.5` or `-1`; none of those is a number of nights, and a fractional one would
 * shift every later date by a fraction of a day the traveller could never see.
 */
export function normalizeNights(nights: number | undefined | null): number {
  if (nights == null || !Number.isFinite(nights)) return 0;
  return Math.min(MAX_NIGHTS, Math.max(0, Math.floor(nights)));
}

/**
 * The complete (place-selected) rows as ordered contract waypoints; incomplete rows don't plan.
 *
 * `nights` and `departure_time` ride along only when they say something, so a trip where nobody
 * stays anywhere sends the body it always did. A dwell is dropped on an overnight stop for the
 * same reason the row hides it: "45 minutes" is not an answer to "you slept there", and sending a
 * hidden one would shift that day's ETAs by a stop the traveller can no longer see.
 */
export function toWaypoints(stops: readonly StopDraft[]): WaypointModel[] {
  return stops
    .filter((s): s is StopDraft & { place: PlaceValue } => !!s.place)
    .slice(0, MAX_STOPS)
    .map((s) => {
      const nights = normalizeNights(s.nights);
      const waypoint: WaypointModel = {
        name: s.place.name,
        latitude: s.place.latitude,
        longitude: s.place.longitude,
        dwell_minutes: nights > 0 ? 0 : s.dwellMinutes,
      };
      if (nights > 0) {
        waypoint.nights = nights;
        if (s.departureTime) waypoint.departure_time = s.departureTime;
      }
      return waypoint;
    });
}

/** Stage saved/staged waypoints back into editable rows (opening a saved multi-stop trip). */
export function fromWaypoints(waypoints: readonly WaypointModel[] | undefined | null): StopDraft[] {
  return (waypoints ?? [])
    .slice(0, MAX_STOPS)
    .map((w) =>
      newStop(
        { name: w.name, latitude: w.latitude, longitude: w.longitude },
        normalizeDwell(w.dwell_minutes),
        normalizeNights(w.nights),
        w.departure_time ?? null,
      ),
    );
}

/**
 * The planned waypoints as the itinerary derivation's stops — fed from the SAME array the plan
 * request carries, so the days shown in the planner cannot disagree with the days the server
 * derives from the body it was sent.
 */
export function toItineraryStops(waypoints: readonly WaypointModel[]): ItineraryStop<PlaceValue>[] {
  return waypoints.map((w) => ({
    place: { name: w.name, latitude: w.latitude, longitude: w.longitude },
    nights: w.nights ?? 0,
    departureTime: w.departure_time ?? null,
  }));
}

/**
 * Trip-identity key extension for briefing staleness (F-001 US-3 / ADR-0031 §3): includes every
 * waypoint AND its dwell, so any stop add/remove/reorder/dwell change yields a different key and
 * invalidates a shown briefing. Empty = legacy A→B identity.
 *
 * Nights and the morning's departure time are in the key too, and they matter more than the rest of
 * it: a night added at a stop moves every later leg onto a different DATE, so a briefing written
 * for the old dates is not merely stale, it is about a different trip.
 */
export function waypointsKey(waypoints: readonly WaypointModel[]): string {
  return waypoints
    .map(
      (w) =>
        `${w.name}@${w.latitude},${w.longitude}:${w.dwell_minutes ?? 0}` +
        `:${w.nights ?? 0}:${w.departure_time ?? ''}`,
    )
    .join('|');
}

/** `/v1/trips/plan` body — waypoints ride along only when there are any (0 stops ≡ legacy A→B). */
export function buildPlanRequest(args: {
  origin: PlaceValue;
  destination: PlaceValue;
  departureAt: string;
  waypoints?: readonly WaypointModel[];
}): PlanTripRequest {
  const body: PlanTripRequest = {
    origin: args.origin,
    destination: args.destination,
    departure_at: args.departureAt,
  };
  if (args.waypoints?.length) body.waypoints = [...args.waypoints];
  return body;
}

/**
 * `/v1/trips/plan-itinerary` body — the SAME fields `/plan` is sent, plus the browser's zone.
 *
 * Built from `buildPlanRequest` rather than beside it, so the two bodies cannot drift: the server
 * derives this trip's travel days from exactly the waypoints `/plan` would have routed as one
 * drive, which is what lets the day list and the per-day plans agree.
 *
 * `timezone` rides along because a stop's `departure_time` is a wall clock — "9am" on day 4 in
 * Arizona is not the same instant as "9am" on day 1 in Texas, and without the zone the server says
 * so rather than pretending otherwise. `Intl` is the browser's own answer; an unavailable one sends
 * nothing rather than a guess.
 */
export function buildItineraryRequest(args: {
  origin: PlaceValue;
  destination: PlaceValue;
  departureAt: string;
  waypoints?: readonly WaypointModel[];
  timezone?: string | null;
}): PlanItineraryRequest {
  const body: PlanItineraryRequest = buildPlanRequest(args);
  if (args.timezone) body.timezone = args.timezone;
  return body;
}

/** The browser's IANA zone, or null where the runtime will not say. */
export function localTimezone(): string | null {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
}

/**
 * `/v1/briefings` body — MUST carry the same waypoints as the plan (the briefing narrates them).
 * F-001 v2 (US-11): `previousFacts` — the prior response's `facts` for this TRIP (see rebrief.ts) —
 * makes the server return a grounded `diff` and lead with it.
 * F-012: `savedTripId` supersedes it when present; the server's stored baseline also carries the
 * prior PLAN version, so it can say WHY the briefing changed rather than just that it did.
 */
export function buildBriefingRequest(args: {
  origin: PlaceValue;
  destination: PlaceValue;
  departureAt: string;
  units: 'imperial' | 'metric';
  waypoints?: readonly WaypointModel[];
  previousFacts?: BriefingFactsModel;
  /**
   * F-012: the SERVER trip id when this is a saved trip. Sent as `trip_id` so the server diffs
   * against that trip's STORED baseline instead of whatever this browser happens to remember —
   * which is what makes the diff survive a reload and cross devices (ADR-0039). Omitted entirely
   * when absent, so an unsaved trip's request is byte-identical to before.
   */
  savedTripId?: string;
}): BriefingRequest {
  const body: BriefingRequest = {
    origin: args.origin,
    destination: args.destination,
    departure_at: args.departureAt,
    units: args.units,
  };
  if (args.waypoints?.length) body.waypoints = [...args.waypoints];
  if (args.previousFacts) body.previous_facts = args.previousFacts;
  if (args.savedTripId) body.trip_id = args.savedTripId;
  return body;
}

/** "Pass through" / "15 min stop" — the shared dwell label (timeline cells + pickers). */
export function formatDwell(minutes: number): string {
  return minutes <= 0 ? 'Pass through' : `${minutes} min stop`;
}

/** "1 night" / "3 nights" — the stay label (day list + stop rows). */
export function formatNights(nights: number): string {
  return `${nights} ${nights === 1 ? 'night' : 'nights'}`;
}
