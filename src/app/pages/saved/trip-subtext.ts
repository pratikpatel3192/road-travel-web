import type { SavedTripModel } from '@road-travel/sdk';

import { deriveLegs, totalDays } from '../../core/itinerary';
import { toItineraryStops } from '../plan/waypoints';

/**
 * The line under a My Trips row: "5 stops · 15 days".
 *
 * One row is one trip, origin to destination, and this is what tells a month-long parks tour apart
 * from tomorrow's airport run at a glance. Both halves are DERIVED — nothing here is a second
 * opinion about a trip's shape:
 *
 * - stops is the saved waypoint list, which is what the planner sent;
 * - days is `totalDays(deriveLegs(...))`, the same derivation the planner draws its travel days
 *   with and the one pinned across Python/TypeScript/Swift by `itinerary.vectors.json`. Deriving
 *   it here a second way is exactly how a trip comes to read as 8 days on one screen and 6 on
 *   another.
 */
export function savedTripSubtext(trip: SavedTripModel): string {
  const parts: string[] = [];
  const stops = trip.waypoints?.length ?? 0;
  // No "0 stops ·" on a plain A → B trip: a count of nothing is noise, not information.
  if (stops > 0) parts.push(`${stops} ${stops === 1 ? 'stop' : 'stops'}`);
  const days = savedTripDays(trip);
  if (days > 0) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  return parts.join(' · ');
}

/**
 * How many days the trip spans — first morning out through the last, inclusive.
 *
 * The nights that make a trip long live on its WAYPOINTS, not on its legs: `TripLegModel` carries a
 * date and no stay, so the server's leg list cannot answer this on its own. It still has the final
 * say on how many days are being driven, though — a trip whose itinerary was built in the leg
 * editor has legs the stop list never knew about, and a trip cannot span fewer days than it has
 * drives.
 */
export function savedTripDays(trip: SavedTripModel): number {
  const place = (name: string, latitude?: number | null, longitude?: number | null) => ({
    name,
    latitude: latitude ?? 0,
    longitude: longitude ?? 0,
  });
  const derived = totalDays(
    deriveLegs({
      origin: place(trip.origin_name, trip.origin_latitude, trip.origin_longitude),
      destination: place(
        trip.destination_name,
        trip.destination_latitude,
        trip.destination_longitude,
      ),
      stops: toItineraryStops(trip.waypoints ?? []),
    }),
  );
  return Math.max(derived, trip.legs?.length ?? 0);
}
