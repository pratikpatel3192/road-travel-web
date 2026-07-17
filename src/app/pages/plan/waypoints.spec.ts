import {
  MAX_STOPS,
  buildBriefingRequest,
  buildPlanRequest,
  fromWaypoints,
  newStop,
  normalizeDwell,
  toWaypoints,
  waypointsKey,
} from './waypoints';

const SF = { name: 'San Francisco, CA', latitude: 37.7749, longitude: -122.4194 };
const LA = { name: 'Los Angeles, CA', latitude: 34.0522, longitude: -118.2437 };
const HARRIS = { name: 'Harris Ranch, CA', latitude: 36.2519, longitude: -120.2378 };
const KETTLEMAN = { name: 'Kettleman City, CA', latitude: 36.0083, longitude: -119.9618 };
const DEPART = '2026-07-16T15:00:00.000Z';

/**
 * F-006: the plan/briefing request composition — waypoints (with dwell presets) must ride along
 * on BOTH requests, and a stop-free trip must stay byte-identical to the legacy A→B body.
 */
describe('F-006 plan/briefing request composition', () => {
  it('includes ordered waypoints + dwell in the plan request', () => {
    const stops = [newStop(HARRIS, 45), newStop(KETTLEMAN, 0)];
    const body = buildPlanRequest({
      origin: SF,
      destination: LA,
      departureAt: DEPART,
      waypoints: toWaypoints(stops),
    });
    expect(body.origin).toEqual(SF);
    expect(body.destination).toEqual(LA);
    expect(body.departure_at).toBe(DEPART);
    expect(body.waypoints).toEqual([
      { name: HARRIS.name, latitude: HARRIS.latitude, longitude: HARRIS.longitude, dwell_minutes: 45 },
      { name: KETTLEMAN.name, latitude: KETTLEMAN.latitude, longitude: KETTLEMAN.longitude, dwell_minutes: 0 },
    ]);
  });

  it('omits the waypoints key entirely with no stops (legacy A→B body unchanged)', () => {
    const body = buildPlanRequest({ origin: SF, destination: LA, departureAt: DEPART, waypoints: [] });
    expect(body).toEqual({ origin: SF, destination: LA, departure_at: DEPART });
    expect('waypoints' in body).toBe(false);
  });

  it('sends the SAME waypoints on the briefing request (the briefing narrates the stops)', () => {
    const waypoints = toWaypoints([newStop(HARRIS, 30)]);
    const briefing = buildBriefingRequest({
      origin: SF,
      destination: LA,
      departureAt: DEPART,
      units: 'imperial',
      waypoints,
    });
    expect(briefing.waypoints).toEqual(waypoints);
    expect(briefing.units).toBe('imperial');
    const noStops = buildBriefingRequest({
      origin: SF,
      destination: LA,
      departureAt: DEPART,
      units: 'metric',
      waypoints: [],
    });
    expect('waypoints' in noStops).toBe(false);
  });
});

describe('F-006 stop drafts <-> waypoints', () => {
  it('drops incomplete rows (no place picked yet) from the planned waypoints', () => {
    const stops = [newStop(null, 15), newStop(HARRIS, 15), newStop(null)];
    expect(toWaypoints(stops)).toEqual([
      { name: HARRIS.name, latitude: HARRIS.latitude, longitude: HARRIS.longitude, dwell_minutes: 15 },
    ]);
  });

  it(`never plans more than the ${MAX_STOPS}-stop cap`, () => {
    const stops = [newStop(HARRIS), newStop(KETTLEMAN), newStop(SF), newStop(LA)];
    expect(toWaypoints(stops)).toHaveLength(MAX_STOPS);
  });

  it('restores saved waypoints into editable rows with unique ids (US-4 re-open)', () => {
    const rows = fromWaypoints([
      { name: HARRIS.name, latitude: HARRIS.latitude, longitude: HARRIS.longitude, dwell_minutes: 45 },
      { name: KETTLEMAN.name, latitude: KETTLEMAN.latitude, longitude: KETTLEMAN.longitude },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].place?.name).toBe(HARRIS.name);
    expect(rows[0].dwellMinutes).toBe(45);
    expect(rows[1].dwellMinutes).toBe(0); // missing dwell defaults to pass-through
    expect(rows[0].id).not.toBe(rows[1].id);
    expect(fromWaypoints(undefined)).toEqual([]);
  });

  it('coerces a non-preset stored dwell onto the preset scale (server validates too)', () => {
    expect(normalizeDwell(45)).toBe(45);
    expect(normalizeDwell(17 as never)).toBe(0);
    expect(normalizeDwell(undefined)).toBe(0);
  });
});

/** ADR-0031 §3: trip identity for briefing staleness includes waypoints AND dwell. */
describe('F-006 waypointsKey (briefing staleness identity)', () => {
  const base = () => toWaypoints([newStop(HARRIS, 15), newStop(KETTLEMAN, 0)]);

  it('is stable for the same stops + dwell', () => {
    expect(waypointsKey(base())).toBe(waypointsKey(base()));
  });

  it('changes when dwell changes, when order changes, and when a stop is added/removed', () => {
    const key = waypointsKey(base());
    expect(waypointsKey(toWaypoints([newStop(HARRIS, 30), newStop(KETTLEMAN, 0)]))).not.toBe(key);
    expect(waypointsKey(toWaypoints([newStop(KETTLEMAN, 0), newStop(HARRIS, 15)]))).not.toBe(key);
    expect(waypointsKey(toWaypoints([newStop(HARRIS, 15)]))).not.toBe(key);
    expect(waypointsKey([])).not.toBe(key);
  });

  it('is empty (legacy A→B identity) with no stops', () => {
    expect(waypointsKey([])).toBe('');
  });
});
