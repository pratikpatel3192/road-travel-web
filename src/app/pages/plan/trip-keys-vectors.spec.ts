import vectors from '../../../../../road-travel-docs/test-vectors/trip-keys.vectors.json';

import { tripBaselineKey, tripIdentityKey } from './rebrief';
import type { PlaceValue } from './place-field';
import type { DwellMinutes } from './waypoints';

/**
 * F-012 client parity: the SHARED `trip-keys.vectors.json` oracle, imported straight from
 * road-travel-docs (repos side by side) so web and the Swift `TripIdentityVectorTests` assert the
 * same file rather than two copies that can drift.
 *
 * The keys are the one thing implemented twice across the clients — the diff itself lives on the
 * server — and they had ALREADY drifted before these vectors existed: iOS coarsened the departure
 * to the clock hour while web used the exact ISO string, so a sub-hour scrubber nudge sent
 * `previous_facts` on iOS and nothing on web. This suite is what makes that fail loudly.
 */

interface VectorTrip {
  origin: PlaceValue;
  destination: PlaceValue;
  departureAt: string;
  waypoints: { name: string; latitude: number; longitude: number; dwellMinutes: number }[];
}

const toWire = (t: VectorTrip) =>
  t.waypoints.map((w) => ({
    name: w.name,
    latitude: w.latitude,
    longitude: w.longitude,
    dwell_minutes: w.dwellMinutes as DwellMinutes,
  }));

/**
 * The dedupe key is iOS-only (web has no local saved-trip collapse), but its ANSWER is part of the
 * shared contract: it is the key the iOS briefing store wrongly used, so web asserts the same
 * oracle to keep both files honest about which key does which job.
 */
function dedupeKey(t: VectorTrip): string {
  const hour = Math.floor(Date.parse(t.departureAt) / 3_600_000);
  const place = (p: PlaceValue) => `${p.name}:${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`;
  const stops = t.waypoints
    .map((w) => `|wp:${w.name}:${w.latitude.toFixed(4)},${w.longitude.toFixed(4)}:${w.dwellMinutes}`)
    .join('');
  return `${place(t.origin)}|${place(t.destination)}|${hour}${stops}`;
}

interface VectorCase {
  name: string;
  trip: VectorTrip;
  base_override?: VectorTrip;
  expected: { dedupeChanged: boolean; briefingChanged: boolean; baselineChanged: boolean };
}

describe('F-012 shared trip-key vectors', () => {
  const base = vectors.base as VectorTrip;
  const cases = vectors.cases as VectorCase[];

  it.each(cases.map((c) => [c.name, c] as const))('%s', (_name, testCase) => {
    const from = testCase.base_override ?? base;
    const to = testCase.trip;
    const ident = (t: VectorTrip) =>
      tripIdentityKey({
        origin: t.origin,
        destination: t.destination,
        departureAt: t.departureAt,
        waypoints: toWire(t),
      });
    const baseline = (t: VectorTrip) =>
      tripBaselineKey({ origin: t.origin, destination: t.destination });

    expect(dedupeKey(to) !== dedupeKey(from)).toBe(testCase.expected.dedupeChanged);
    expect(ident(to) !== ident(from)).toBe(testCase.expected.briefingChanged);
    expect(baseline(to) !== baseline(from)).toBe(testCase.expected.baselineChanged);
  });

  it('covers the regression that started F-012: a sub-hour departure nudge', () => {
    const nudge = cases.find((c) => c.name === 'departure_plus_5_min_same_clock_hour');
    expect(nudge).toBeDefined();
    // Same dedupe answer (the hour bucket), different briefing answer — conflating them is the bug.
    expect(nudge!.expected.dedupeChanged).toBe(false);
    expect(nudge!.expected.briefingChanged).toBe(true);
    expect(nudge!.expected.baselineChanged).toBe(false);
  });
});
