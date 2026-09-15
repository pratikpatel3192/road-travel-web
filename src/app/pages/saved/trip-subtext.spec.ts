import type { SavedTripModel, TripLegModel, WaypointModel } from '@road-travel/sdk';
import { describe, expect, it } from 'vitest';

import { savedTripDays, savedTripSubtext } from './trip-subtext';

/**
 * The exact strings, not the numbers behind them.
 *
 * This is user-facing copy assembled from counts, which is the shape of thing this codebase has
 * already got wrong four times — "1 stops", "5 stop", a stray "0 stops ·" leading the line. Asserting
 * the rendered sentence is the only way that fails here rather than on someone's screen.
 */

const stop = (name: string, nights = 0): WaypointModel => ({
  name,
  latitude: 0,
  longitude: 0,
  nights,
});

const leg = (ordinal: number): TripLegModel => ({
  ordinal,
  origin: { name: 'a', latitude: 0, longitude: 0 },
  destination: { name: 'b', latitude: 0, longitude: 0 },
});

const trip = (over: Partial<SavedTripModel> = {}): SavedTripModel => ({
  id: 't1',
  origin_name: 'Dallas, TX',
  destination_name: 'Los Angeles, CA',
  departure_at: '2026-10-01T13:00:00Z',
  created_at: '2026-09-14T00:00:00Z',
  ...over,
});

describe('My Trips row subtext', () => {
  it('says nothing about stops when there are none', () => {
    // Not "0 stops · 1 day". A count of nothing is noise, and it led the line.
    expect(savedTripSubtext(trip())).toBe('1 day');
  });

  it('is singular for one of each', () => {
    expect(savedTripSubtext(trip({ waypoints: [stop('Amarillo, TX')] }))).toBe('1 stop · 1 day');
  });

  it('is plural for several', () => {
    const waypoints = [
      stop('Amarillo, TX'),
      stop('Albuquerque, NM', 3),
      stop('Flagstaff, AZ'),
      stop('Phoenix, AZ', 2),
      stop('Palm Springs, CA'),
    ];
    // Five stops, two of them overnight: three drives spread over the six days between the first
    // morning out and the last.
    expect(savedTripSubtext(trip({ waypoints }))).toBe('5 stops · 6 days');
  });

  it('counts a lone overnight stay as the two days it spans', () => {
    expect(savedTripSubtext(trip({ waypoints: [stop('Amarillo, TX', 1)] }))).toBe(
      '1 stop · 2 days',
    );
  });

  it('is one day for a trip with no legs recorded', () => {
    // Every trip saved before legs existed. It is still a drive, and a drive is a day.
    expect(savedTripSubtext(trip({ legs: [] }))).toBe('1 day');
  });

  it('takes the server at its word when the itinerary has more days than the stops imply', () => {
    // Days added in the old (removed) leg editor are not stops and carry no nights, so the stop-based derivation
    // cannot see them — but a trip cannot span fewer days than it has drives.
    const t = trip({ legs: [leg(0), leg(1), leg(2), leg(3)] });
    expect(savedTripDays(t)).toBe(4);
    expect(savedTripSubtext(t)).toBe('4 days');
  });

  it('matches the shared travel-day derivation rather than re-counting', () => {
    // Dallas → Albuquerque (3 nights) → Phoenix (2) → Los Angeles is 1 + 5 = 6 days, which is what
    // `itinerary.vectors.json` pins across Python, TypeScript and Swift.
    const t = trip({ waypoints: [stop('Albuquerque, NM', 3), stop('Phoenix, AZ', 2)] });
    expect(savedTripDays(t)).toBe(6);
  });
});
