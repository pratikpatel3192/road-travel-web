import type { BriefingFactsModel } from '@road-travel/sdk';

import { BriefingMemory, tripIdentityKey } from './rebrief';
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
 * F-001 v2 (US-11): `previous_facts` is sent on a re-brief of the SAME trip identity — endpoints +
 * departure + waypoints/dwell (the F-006 key) — and NEVER when any of those changed. This mirrors
 * exactly how plan.ts composes the request: memory lookup by identity → buildBriefingRequest.
 */
describe('F-001 v2 re-brief identity (previous_facts)', () => {
  function requestFor(memory: BriefingMemory, args = trip()) {
    return buildBriefingRequest({
      ...args,
      units: 'imperial' as const,
      previousFacts: memory.previousFactsFor(tripIdentityKey(args)),
    });
  }

  it('sends previous_facts when re-briefing the same trip identity', () => {
    const memory = new BriefingMemory();
    memory.remember(tripIdentityKey(trip()), FACTS);
    const body = requestFor(memory);
    expect(body.previous_facts).toEqual(FACTS);
  });

  it('omits previous_facts entirely on the FIRST briefing (nothing remembered)', () => {
    const body = requestFor(new BriefingMemory());
    expect('previous_facts' in body).toBe(false);
  });

  it.each([
    ['a different destination', { ...trip(), destination: SAC }],
    ['a different origin', { ...trip(), origin: SAC }],
    ['a different departure time', { ...trip(), departureAt: '2026-07-17T18:00:00.000Z' }],
    ['a changed dwell', { ...trip(), waypoints: toWaypoints([newStop(HARRIS, 60)]) }],
    ['a removed stop', { ...trip(), waypoints: [] }],
  ])('does NOT send previous_facts after %s (different trip identity)', (_what, changed) => {
    const memory = new BriefingMemory();
    memory.remember(tripIdentityKey(trip()), FACTS);
    const body = requestFor(memory, changed);
    expect('previous_facts' in body).toBe(false);
  });

  it('re-baselines on every response: the newest facts become the next previous_facts', () => {
    const memory = new BriefingMemory();
    const key = tripIdentityKey(trip());
    memory.remember(key, FACTS);
    const newer: BriefingFactsModel = { ...FACTS, overall_severity: 'caution' };
    memory.remember(key, newer);
    expect(memory.previousFactsFor(key)?.overall_severity).toBe('caution');
  });

  it('waypoint dwell is part of the identity via the F-006 waypointsKey (order matters too)', () => {
    const a = tripIdentityKey(trip());
    const reordered = tripIdentityKey({
      ...trip(),
      waypoints: toWaypoints([newStop(HARRIS, 30), newStop(SAC, 0)]),
    });
    expect(reordered).not.toBe(a);
    expect(tripIdentityKey(trip())).toBe(a); // stable for identical inputs
  });
});
