/**
 * The travel days a trip is actually driven over, derived from its stops.
 *
 * A traveller plans ONE trip — Dallas to Los Angeles, three nights in Albuquerque and two in
 * Phoenix on the way — not three separate ones. The days are a CONSEQUENCE of where they stay, so
 * they are derived here rather than typed anywhere.
 *
 * A port of `road-travel-core/src/road_travel_core/services/itinerary.py`, pinned to the shared
 * `road-travel-docs/test-vectors/itinerary.vectors.json` by `itinerary-vectors.spec.ts` — that file,
 * not this comment, is what keeps the Python, TypeScript and Swift answers the same.
 *
 * It is pure and framework-free on purpose: the planner draws the days while the user is still
 * typing, before anything is saved, so this cannot be a round trip to the server.
 */

import { isoDay, parseIsoDay } from './forecast-horizon';

/**
 * One stop on the route, generic in its place type so a caller keeps whatever it already has —
 * the planner passes its full `PlaceValue` rows and gets them back on the legs, with no cast and
 * no coordinates dropped on the way through.
 */
export interface ItineraryStop<P> {
  place: P;
  /** Nights spent HERE. 0 is a pass-through stop, which never ends a travel day. */
  nights: number;
  /**
   * What time they set off from here the next morning. `null` means "sometime that day" — a real
   * answer, and never replaced by a guess (a guessed hour would be carried as fact by ETA maths).
   */
  departureTime: string | null;
}

/** One travel day: where it starts, where it ends, when it leaves, what it passes through. */
export interface DerivedLeg<P> {
  ordinal: number;
  origin: P;
  destination: P;
  /** The pass-through stops on THIS leg — the ones nobody sleeps at. */
  waypoints: P[];
  /** `YYYY-MM-DD`, or null when the trip has no departure date yet. */
  travelDate: string | null;
  departureTime: string | null;
  /** Nights at this leg's destination before the next one leaves. Always 0 on the final leg. */
  nightsAtDestination: number;
}

export interface ItineraryInput<P> {
  origin: P;
  destination: P;
  stops: readonly ItineraryStop<P>[];
  /** The trip's own departure day, `YYYY-MM-DD`. Absent or unparseable ⇒ every day is undated. */
  departureDate?: string | null;
  /** The FIRST leg's departure time. Later legs take theirs from the stop they leave from. */
  departureTime?: string | null;
}

/**
 * The travel days implied by a route and its overnight stops.
 *
 * The rule, and the only arithmetic here: the next leg leaves this leg's date + one day to drive it
 * + the nights stayed at the far end. Dates are assigned only when `departureDate` is given —
 * an undated trip derives undated days, because inventing dates would decide which weather each
 * day is matched against.
 *
 * A trip nobody stays anywhere on is not a special case: with no overnight stop the loop below
 * appends nothing and the final leg carries every stop as a pass-through, which is the single
 * travel day such a trip has always been.
 */
export function deriveLegs<P>(input: ItineraryInput<P>): DerivedLeg<P>[] {
  const legs: DerivedLeg<P>[] = [];
  let legOrigin = input.origin;
  let legDepartureTime: string | null = null;
  let pending: P[] = [];
  let cursor = normalizeDay(input.departureDate);

  for (const stop of input.stops) {
    if (stop.nights <= 0) {
      pending.push(stop.place); // lunch — stays inside this leg
      continue;
    }
    legs.push({
      ordinal: legs.length,
      origin: legOrigin,
      destination: stop.place,
      waypoints: pending,
      travelDate: cursor,
      // A leg's time comes from where it STARTS: the trip's own for leg 1, the overnight stop's
      // own for every leg after it.
      departureTime: legs.length === 0 ? (input.departureTime ?? null) : legDepartureTime,
      nightsAtDestination: stop.nights,
    });
    cursor = addDays(cursor, 1 + stop.nights);
    legOrigin = stop.place;
    legDepartureTime = stop.departureTime;
    pending = [];
  }

  legs.push({
    ordinal: legs.length,
    origin: legOrigin,
    destination: input.destination,
    waypoints: pending,
    travelDate: cursor,
    departureTime: legs.length === 0 ? (input.departureTime ?? null) : legDepartureTime,
    nightsAtDestination: 0,
  });
  return legs;
}

/**
 * How long the trip takes end to end — travel days plus every night stayed.
 *
 * Dallas → Albuquerque (3) → Phoenix (2) → Los Angeles is 3 + 5 = 8.
 */
export function totalDays<P>(legs: readonly DerivedLeg<P>[]): number {
  return legs.length + legs.reduce((sum, leg) => sum + leg.nightsAtDestination, 0);
}

/** The nights stayed across the whole trip — what separates "8 days" from "3 drives". */
export function totalNights<P>(legs: readonly DerivedLeg<P>[]): number {
  return legs.reduce((sum, leg) => sum + leg.nightsAtDestination, 0);
}

/**
 * A date that is not a calendar day reads as no date at all, rather than as `Invalid Date`
 * propagating into every later leg — the planner's date field is empty for part of every edit.
 */
function normalizeDay(value: string | null | undefined): string | null {
  return parseIsoDay(value) ? (value ?? null) : null;
}

/**
 * Day arithmetic done on the LOCAL calendar (`setDate`) rather than by adding 86.4M milliseconds:
 * a leg that crosses a DST boundary would otherwise land an hour short and lose or gain a day.
 */
function addDays(day: string | null, days: number): string | null {
  const parsed = parseIsoDay(day);
  if (!parsed) return null;
  parsed.setDate(parsed.getDate() + days);
  return isoDay(parsed);
}
