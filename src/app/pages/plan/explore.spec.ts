import {
  buildAddStopPreviewRequest,
  buildExploreRequest,
  categoryLabel,
  exposureDeltaLabel,
  formatDetour,
  worstDeltaLabel,
} from './explore';
import { newStop, toWaypoints } from './waypoints';

const CUP = { name: 'Cupertino, CA', latitude: 37.323, longitude: -122.0322 };
const SAC = { name: 'Sacramento, CA', latitude: 38.5816, longitude: -121.4944 };
const HARRIS = { name: 'Harris Ranch, CA', latitude: 36.2519, longitude: -120.2378 };
const DEPART = '2026-07-18T15:00:00.000Z';

/**
 * F-005: the explore request must carry the CURRENT trip identity — the same origin/destination/
 * departure/waypoints composition the plan request sends — plus the intent + chip state.
 */
describe('F-005 buildExploreRequest', () => {
  it('carries the full trip identity including the F-006 waypoints', () => {
    const waypoints = toWaypoints([newStop(HARRIS, 45)]);
    const body = buildExploreRequest({
      origin: CUP,
      destination: SAC,
      departureAt: DEPART,
      waypoints,
      intent: 'passenger_stops',
    });
    expect(body.origin).toEqual(CUP);
    expect(body.destination).toEqual(SAC);
    expect(body.departure_at).toBe(DEPART);
    expect(body.waypoints).toEqual([
      { name: HARRIS.name, latitude: HARRIS.latitude, longitude: HARRIS.longitude, dwell_minutes: 45 },
    ]);
    expect(body.intent).toBe('passenger_stops');
    // No chip state -> the optional keys are omitted entirely.
    expect('params' in body).toBe(false);
    expect('refinements' in body).toBe(false);
  });

  it('omits the waypoints key on a stop-free trip (legacy A→B identity)', () => {
    const body = buildExploreRequest({
      origin: CUP,
      destination: SAC,
      departureAt: DEPART,
      waypoints: [],
      intent: 'scenic',
    });
    expect('waypoints' in body).toBe(false);
  });

  it('add_stop_search sends the trimmed query as params.query', () => {
    const body = buildExploreRequest({
      origin: CUP,
      destination: SAC,
      departureAt: DEPART,
      intent: 'add_stop_search',
      query: '  Starbucks ',
    });
    expect(body.params).toEqual({ query: 'Starbucks' });
  });

  it('a category chip becomes params.category (single-category filter)', () => {
    const body = buildExploreRequest({
      origin: CUP,
      destination: SAC,
      departureAt: DEPART,
      intent: 'passenger_stops',
      category: 'playground',
    });
    expect(body.params).toEqual({ category: 'playground' });
  });

  it('refinement re-calls keep the PRIOR params (query/category) alongside refinements', () => {
    const body = buildExploreRequest({
      origin: CUP,
      destination: SAC,
      departureAt: DEPART,
      intent: 'add_stop_search',
      query: 'EV charger',
      category: 'charging_station',
      refinements: ['closer_to_halfway', 'shorter_detour'],
    });
    expect(body.params).toEqual({ query: 'EV charger', category: 'charging_station' });
    expect(body.refinements).toEqual(['closer_to_halfway', 'shorter_detour']);
  });
});

describe('F-005 buildAddStopPreviewRequest', () => {
  it('sends the trip as planned + the candidate stop with the CHOSEN dwell', () => {
    const waypoints = toWaypoints([newStop(HARRIS, 15)]);
    const body = buildAddStopPreviewRequest({
      origin: CUP,
      destination: SAC,
      departureAt: DEPART,
      waypoints,
      stop: { name: 'Vista Point', latitude: 37.1, longitude: -121.9 },
      dwellMinutes: 45,
    });
    expect(body.waypoints).toEqual(waypoints);
    expect(body.stop).toEqual({
      name: 'Vista Point',
      latitude: 37.1,
      longitude: -121.9,
      dwell_minutes: 45,
    });
    const noStops = buildAddStopPreviewRequest({
      origin: CUP,
      destination: SAC,
      departureAt: DEPART,
      waypoints: [],
      stop: { name: 'Vista Point', latitude: 37.1, longitude: -121.9 },
      dwellMinutes: 0,
    });
    expect('waypoints' in noStops).toBe(false);
    expect(noStops.stop.dwell_minutes).toBe(0);
  });
});

describe('F-005 display helpers', () => {
  it('formats the detour with one decimal in the display units', () => {
    expect(formatDetour(1234, 'metric')).toBe('1.2 km off-route');
    expect(formatDetour(1234, 'imperial')).toBe('0.8 mi off-route');
  });

  it('summarizes the exposure/worst-severity deltas ("unchanged" when equal)', () => {
    const p = {
      added_seconds: 1320,
      added_meters: 9000,
      dwell_seconds: 1800,
      arrival_before: '2026-07-18T17:25:00Z',
      arrival_after: '2026-07-18T18:32:00Z',
      exposure_before: 4,
      exposure_after: 2,
      worst_before: 'caution',
      worst_after: 'caution',
    } as const;
    expect(exposureDeltaLabel(p)).toBe('weather exposure 4 → 2');
    expect(worstDeltaLabel(p)).toBe('worst stretch unchanged');
    const worse = { ...p, exposure_before: 2, worst_after: 'severe' } as const;
    expect(exposureDeltaLabel(worse)).toBe('weather exposure unchanged');
    expect(worstDeltaLabel(worse)).toBe('worst stretch Caution → Severe');
  });

  it('prettifies category ids for the card badge', () => {
    expect(categoryLabel('rest_area')).toBe('Rest area');
    expect(categoryLabel('park')).toBe('Park');
    expect(categoryLabel(undefined)).toBe('');
  });
});
