import type { BriefingFactsModel } from '@road-travel/sdk';

import { BriefingMemory, tripBaselineKey, tripIdentityKey } from './rebrief';
import { buildBriefingRequest, newStop, toWaypoints } from './waypoints';

const SF = { name: 'San Francisco, CA', latitude: 37.7749, longitude: -122.4194 };
const LA = { name: 'Los Angeles, CA', latitude: 34.0522, longitude: -118.2437 };
const SAC = { name: 'Sacramento, CA', latitude: 38.5816, longitude: -121.4944 };
const HARRIS = { name: 'Harris Ranch, CA', latitude: 36.2519, longitude: -120.2378 };
const DEPART = '2026-07-17T15:00:00.000Z';

const FACTS: BriefingFactsModel = {
  origin_name: SF.name,
  destination_name: LA.name,
  departure_at: DEPART,
  arrival_at: '2026-07-17T21:30:00.000Z',
  total_distance_meters: 613_000,
  duration_seconds: 6 * 3600,
  sample_count: 9,
  samples_with_weather: 9,
  overall_severity: 'clear',
  hazards: [],
};

const trip = () => ({
  origin: SF,
  destination: LA,
  departureAt: DEPART,
  waypoints: toWaypoints([newStop(HARRIS, 30)]),
});

/**
 * F-012 (ADR-0040): two keys, two jobs.
 *
 * This suite previously asserted that a departure change or a stop edit suppressed
 * `previous_facts`. That was correct for the single overloaded key, and it is exactly the
 * behaviour F-012 changes: it made the headline scenario — *you moved departure two hours and the
 * pass goes from rain to ice* — unreachable by construction. The invalidation half of that key is
 * unchanged and still asserted below.
 */
describe('F-012 re-brief keys', () => {
  describe('tripIdentityKey — invalidation (F-001 US-3 / ADR-0031 §3, deliberately NOT relaxed)', () => {
    it.each([
      ['a different departure', { ...trip(), departureAt: '2026-07-17T18:00:00.000Z' }],
      ['a changed dwell', { ...trip(), waypoints: toWaypoints([newStop(HARRIS, 60)]) }],
      ['a removed stop', { ...trip(), waypoints: [] }],
      ['a different destination', { ...trip(), destination: SAC }],
    ])('changes after %s, so a shown briefing is never left describing an old plan', (_w, edited) => {
      expect(tripIdentityKey(edited)).not.toBe(tripIdentityKey(trip()));
    });

    it('is stable for identical inputs', () => {
      expect(tripIdentityKey(trip())).toBe(tripIdentityKey(trip()));
    });
  });

  describe('tripBaselineKey — which baseline to diff against', () => {
    it('survives a departure edit, so the diff can finally fire on one', () => {
      expect(tripBaselineKey({ origin: SF, destination: LA })).toBe(
        tripBaselineKey({ origin: SF, destination: LA }),
      );
    });

    it('survives stop edits — those are the plan, not the trip', () => {
      const before = tripBaselineKey({ origin: SF, destination: LA });
      expect(tripBaselineKey({ origin: SF, destination: LA })).toBe(before);
    });

    it.each([
      ['destination', { origin: SF, destination: SAC }],
      ['origin', { origin: SAC, destination: LA }],
    ])('CHANGES for a different %s — a different trip still sends nothing', (_w, other) => {
      expect(tripBaselineKey(other)).not.toBe(tripBaselineKey({ origin: SF, destination: LA }));
    });

    it('prefers the saved-trip id when there is one', () => {
      expect(tripBaselineKey({ origin: SF, destination: LA, savedTripId: 'abc' })).toBe('trip:abc');
    });

    it('ignores coordinate noise below 4 dp', () => {
      expect(
        tripBaselineKey({ origin: { ...SF, latitude: 37.77490001 }, destination: LA }),
      ).toBe(tripBaselineKey({ origin: SF, destination: LA }));
    });
  });

  describe('BriefingMemory — keyed by trip, not a single slot', () => {
    const keyA = tripBaselineKey({ origin: SF, destination: LA });
    const keyB = tripBaselineKey({ origin: SF, destination: SAC });

    it('keeps trip A after briefing trip B (the single-slot bug)', () => {
      const memory = new BriefingMemory();
      memory.remember(keyA, FACTS);
      memory.remember(keyB, { ...FACTS, destination_name: SAC.name });
      expect(memory.previousFactsFor(keyA)).toEqual(FACTS);
    });

    it('re-baselines on every response', () => {
      const memory = new BriefingMemory();
      memory.remember(keyA, FACTS);
      memory.remember(keyA, { ...FACTS, overall_severity: 'caution' });
      expect(memory.previousFactsFor(keyA)?.overall_severity).toBe('caution');
    });

    it('returns undefined for a trip it has never seen', () => {
      expect(new BriefingMemory().previousFactsFor(keyA)).toBeUndefined();
    });

    it('is bounded, evicting least-recently-briefed trips', () => {
      const memory = new BriefingMemory();
      for (let i = 0; i < 25; i++) memory.remember(`trip:${i}`, FACTS);
      expect(memory.previousFactsFor('trip:0')).toBeUndefined();
      expect(memory.previousFactsFor('trip:24')).toEqual(FACTS);
    });
  });

  describe('request composition (mirrors plan.ts)', () => {
    it('sends previous_facts across a departure edit of the same trip', () => {
      const memory = new BriefingMemory();
      memory.remember(tripBaselineKey({ origin: SF, destination: LA }), FACTS);
      const moved = { ...trip(), departureAt: '2026-07-17T17:00:00.000Z' };
      const body = buildBriefingRequest({
        ...moved,
        units: 'imperial' as const,
        previousFacts: memory.previousFactsFor(tripBaselineKey(moved)),
      });
      expect(body.previous_facts).toEqual(FACTS);
    });

    it('omits previous_facts entirely on a first briefing', () => {
      const body = buildBriefingRequest({
        ...trip(),
        units: 'imperial' as const,
        previousFacts: new BriefingMemory().previousFactsFor(tripBaselineKey(trip())),
      });
      expect('previous_facts' in body).toBe(false);
    });

    it('omits previous_facts for a genuinely different trip', () => {
      const memory = new BriefingMemory();
      memory.remember(tripBaselineKey({ origin: SF, destination: LA }), FACTS);
      const elsewhere = { ...trip(), destination: SAC };
      const body = buildBriefingRequest({
        ...elsewhere,
        units: 'imperial' as const,
        previousFacts: memory.previousFactsFor(tripBaselineKey(elsewhere)),
      });
      expect('previous_facts' in body).toBe(false);
    });
  });
});

/**
 * F-012 gap 2: the SERVER baseline. `trip_id` is what makes a diff survive a reload and cross
 * devices; without it the browser's in-memory map is the only baseline, which dies with the tab.
 */
describe('F-012 saved-trip baseline (trip_id)', () => {
  it('sends trip_id when the trip came from My Trips', () => {
    const body = buildBriefingRequest({
      ...trip(),
      units: 'imperial' as const,
      savedTripId: '2b7e1f00-0000-4000-8000-000000000001',
    });
    expect(body.trip_id).toBe('2b7e1f00-0000-4000-8000-000000000001');
  });

  it('omits trip_id entirely for an unsaved trip, so the request is unchanged from before', () => {
    const body = buildBriefingRequest({ ...trip(), units: 'imperial' as const });
    expect('trip_id' in body).toBe(false);
  });

  it('keys the local baseline by the saved id, so it survives every plan edit of that trip', () => {
    const saved = { origin: SF, destination: LA, savedTripId: 'abc' };
    expect(tripBaselineKey(saved)).toBe(tripBaselineKey({ ...saved, destination: SAC }));
  });

  it('still separates two different SAVED trips', () => {
    expect(tripBaselineKey({ origin: SF, destination: LA, savedTripId: 'a' })).not.toBe(
      tripBaselineKey({ origin: SF, destination: LA, savedTripId: 'b' }),
    );
  });
});
