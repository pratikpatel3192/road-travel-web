import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsService } from '../../core/analytics.service';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { EntitlementService } from '../../core/entitlement.service';
import { ApiError } from '../../core/errors';
import { GeocodeService } from '../../core/geocode.service';
import { PaywallService } from '../../core/paywall.service';
import { SettingsService } from '../../core/settings.service';
import type { StagedTrip } from '../../core/trips.service';
import { TripsService } from '../../core/trips.service';
import { Plan } from './plan';
import { newStop } from './waypoints';

const CHICAGO = { name: 'Chicago, IL', latitude: 41.8781, longitude: -87.6298 };
const STL = { name: 'St. Louis, MO', latitude: 38.627, longitude: -90.1994 };
const DALLAS = { name: 'Dallas, TX', latitude: 32.7767, longitude: -96.797 };

const NOW = Date.parse('2026-09-15T12:00:00Z');
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();

const dayPlan = (over: Record<string, unknown> = {}) => ({
  origin: CHICAGO,
  destination: DALLAS,
  departure_at: iso(NOW + 20 * HOUR),
  arrival_at: iso(NOW + 34 * HOUR),
  distance_meters: 1_500_000,
  duration_seconds: 14 * 3600,
  waypoints: [],
  total_dwell_seconds: 0,
  worst_severity: 'caution',
  route_coordinates: [{ latitude: 41.8, longitude: -87.6 }],
  samples: [{ index: 0, distance_from_start_meters: 0, latitude: 41.8, longitude: -87.6 }],
  segments: [],
  meta: { sample_count: 1, segment_count: 0, route_point_count: 1, provider_mode: 'mock' },
  ...over,
});

const briefing = (over: Record<string, unknown> = {}) => ({
  text: 'Rain near Springfield.',
  facts: { overall_severity: 'caution', hazards: [] },
  model: 'template',
  generated_at: iso(NOW - 3 * HOUR),
  claims: [],
  ...over,
});

const itinerary = () => ({
  days: [
    {
      ordinal: 0,
      travel_date: '2026-09-16',
      nights_at_destination: 2,
      beyond_forecast: false,
      plan: dayPlan({ destination: STL }),
      error: null,
    },
    {
      ordinal: 1,
      travel_date: '2026-09-18',
      nights_at_destination: 0,
      beyond_forecast: false,
      plan: dayPlan({ origin: STL, worst_severity: 'severe' }),
      error: null,
    },
  ],
  total_days: 3,
  total_nights: 2,
  worst_severity: 'severe',
});

const tripBriefing = (over: Record<string, unknown> = {}) => ({
  text: '2 drives across 3 days.',
  model: 'template',
  generated_at: iso(NOW - 3 * HOUR),
  snapshot: [{ ordinal: 0, severity: 'clear', beyond_forecast: false }],
  days: [],
  rollup: {
    total_days: 3,
    total_nights: 2,
    total_distance_meters: 3_000_000,
    days_with_forecast: 2,
    days_beyond_forecast: 0,
    days_failed: 0,
    partly_unknown: false,
  },
  ...over,
});

type ApiSpies = Record<string, ReturnType<typeof vi.fn>>;

function recordingApi(stubs: ApiSpies): ApiSpies {
  return new Proxy(stubs, {
    get(target, prop) {
      if (typeof prop !== 'string' || prop === 'then') return undefined;
      target[prop] ??= vi.fn(async () => undefined);
      return target[prop];
    },
  });
}

/** A stored single-day snapshot, as `GET /v1/trips/{id}/snapshot` returns it. */
const singleSnapshot = (over: Record<string, unknown> = {}) => ({
  kind: 'single',
  schema_version: 1,
  planned_at: iso(NOW - 3 * HOUR),
  departure_at: iso(NOW + 20 * HOUR),
  updated_at: iso(NOW - 3 * HOUR),
  payload: { plan: dayPlan(), briefing: briefing() },
  ...over,
});

/**
 * Opening a trip from My Trips shows what it was last planned as, instead of planning it again.
 *
 * The requirement is the traveller's own: opening a trip must not fetch fresh data unless they ask
 * for it. So the load-bearing assertion throughout is not what renders but what is CALLED — every
 * ApiService method is a spy, and the happy path may touch exactly one of them, once.
 *
 * The component class is exercised directly rather than rendered: `Plan`'s template pulls in
 * Leaflet, which does not run in jsdom.
 */
describe('Plan — opening a saved trip from its stored snapshot', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let staged: StagedTrip | null;
  let notice: { set: ReturnType<typeof vi.fn> };
  let hasRealAccount: boolean;

  const stagedTrip = (over: Partial<StagedTrip> = {}): StagedTrip => ({
    origin: CHICAGO,
    destination: DALLAS,
    departureAt: iso(NOW + 20 * HOUR),
    waypoints: [],
    savedTripId: 'trip-1',
    ...over,
  });

  function build(): Plan {
    // A Proxy, so a call to ANY ApiService method is recorded — including one this spec never
    // thought to stub. A plain object would let an unexpected call throw inside a try and vanish.
    api = recordingApi({
      getTripSnapshot: vi.fn(async () => singleSnapshot()),
      saveTripSnapshot: vi.fn(async () => undefined),
      planTrip: vi.fn(async () => dayPlan({ worst_severity: 'clear' })),
      planItinerary: vi.fn(async () => itinerary()),
      createBriefing: vi.fn(async () => briefing({ text: 'Fresh.' })),
      createItineraryBriefing: vi.fn(async () => tripBriefing({ text: 'Fresh trip.' })),
      saveTrip: vi.fn(async () => ({ id: 'trip-1', revision: 'rev-2' })),
    });
    notice = { set: vi.fn() };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
        {
          provide: GeocodeService,
          useValue: { search: vi.fn(async () => []), reverse: vi.fn(async () => null) },
        },
        { provide: ApiService, useValue: api },
        { provide: EntitlementService, useValue: { refresh: vi.fn(async () => undefined) } },
        {
          provide: TripsService,
          useValue: {
            takeStaged: () => {
              const s = staged;
              staged = null;
              return s;
            },
            refresh: vi.fn(async () => undefined),
            notice,
          },
        },
        { provide: AnalyticsService, useValue: { capture: vi.fn() } },
        { provide: PaywallService, useValue: { show: vi.fn() } },
        {
          provide: AuthService,
          useValue: { configured: () => true, hasRealAccount: () => hasRealAccount },
        },
        {
          provide: SettingsService,
          useValue: {
            units: () => 'imperial',
            home: () => null,
            work: () => null,
            setUnits: vi.fn(),
          },
        },
      ],
    });
    return TestBed.runInInjectionContext(() => new Plan());
  }

  /** Every ApiService method that was called, by name. */
  const called = () =>
    Object.entries(api)
      .filter(([, fn]) => fn.mock.calls.length > 0)
      .map(([name]) => name)
      .sort();

  /** Open the staged trip and let the GET, and anything it might chain, settle. */
  async function open(trip: StagedTrip = stagedTrip()): Promise<Plan> {
    staged = trip;
    const plan = build();
    plan.ngOnInit();
    await vi.advanceTimersByTimeAsync(0);
    return plan;
  }

  /** Past the auto-save debounce, with everything it chains settled. */
  const settle = () => vi.advanceTimersByTimeAsync(2_500);

  beforeEach(() => {
    hasRealAccount = true;
    staged = null;
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  describe('a fresh snapshot', () => {
    it('makes exactly one call — the GET — and plans, briefs and saves nothing', async () => {
      await open();
      // Past the auto-save debounce too: a save scheduled by opening would land here.
      await settle();

      expect(called()).toEqual(['getTripSnapshot']);
      expect(api['getTripSnapshot']).toHaveBeenCalledTimes(1);
      expect(api['getTripSnapshot']).toHaveBeenCalledWith('trip-1');
    });

    it('renders the stored plan and briefing, dated', async () => {
      const plan = await open();

      expect(plan.plan()).toEqual(dayPlan());
      expect(plan.itinerary()).toBeNull();
      expect(plan.briefing()?.text).toBe('Rain near Springfield.');
      expect(plan.snapshotShown()).toEqual({
        plannedAt: iso(NOW - 3 * HOUR),
        departureAt: iso(NOW + 20 * HOUR),
      });
      expect(plan.loading()).toBe(false);
      expect(plan.error()).toBeNull();
    });

    it('renders a stored multi-day trip: every day, the first day selected, the trip briefing', async () => {
      const stops = [newStop(STL, 0, 2)];
      staged = stagedTrip({
        waypoints: [{ ...STL, dwell_minutes: 0, nights: 2 }],
      });
      const plan = build();
      api['getTripSnapshot'].mockResolvedValue({
        ...singleSnapshot(),
        kind: 'itinerary',
        payload: { itinerary: itinerary(), briefing: tripBriefing() },
      });
      plan.ngOnInit();
      await vi.advanceTimersByTimeAsync(0);
      await settle();

      expect(called()).toEqual(['getTripSnapshot']);
      expect(plan.itinerary()?.days).toHaveLength(2);
      expect(plan.plan()).toBeNull();
      expect(plan.selectedDay()).toBe(0);
      expect(plan.shownPlan()?.destination).toEqual(STL);
      expect(plan.tripBriefing()?.text).toBe('2 drives across 3 days.');
      expect(plan.briefing()).toBeNull();
      // The stops (and their nights) are the trip as saved.
      expect(plan.stops().map((s) => [s.place?.name, s.nights])).toEqual(
        stops.map((s) => [s.place?.name, s.nights]),
      );
    });

    it('shows the departure field as the trip was saved', async () => {
      const plan = await open();
      expect(new Date(plan.departureAt()).getTime()).toBe(NOW + 20 * HOUR);
    });

    it('does not announce a change nobody asked the server about', async () => {
      // The stored briefing was itself a re-brief with a material diff. Opening it asked the server
      // nothing, so the "Updated" badge must not come back with it.
      staged = stagedTrip();
      const plan = build();
      api['getTripSnapshot'].mockResolvedValue(
        singleSnapshot({
          payload: {
            plan: dayPlan(),
            briefing: briefing({ diff: { material: true, changes: ['rain → snow'] } }),
          },
        }),
      );
      plan.ngOnInit();
      await vi.advanceTimersByTimeAsync(0);

      expect(plan.briefing()?.text).toBe('Rain near Springfield.');
      expect(plan.briefing()?.diff ?? null).toBeNull();
    });

    it('is still shown one minute short of two days old', async () => {
      staged = stagedTrip();
      const plan = build();
      api['getTripSnapshot'].mockResolvedValue(
        singleSnapshot({ planned_at: iso(NOW - 48 * HOUR + 60_000) }),
      );
      plan.ngOnInit();
      await vi.advanceTimersByTimeAsync(0);

      expect(called()).toEqual(['getTripSnapshot']);
      expect(plan.snapshotShown()).not.toBeNull();
    });
  });

  describe('a snapshot whose departure has passed', () => {
    it('is still shown as stored, with the departure it was saved with', async () => {
      const lastNight = NOW - 10 * HOUR;
      staged = stagedTrip({ departureAt: iso(lastNight) });
      const plan = build();
      api['getTripSnapshot'].mockResolvedValue(
        singleSnapshot({ planned_at: iso(NOW - 20 * HOUR), departure_at: iso(lastNight) }),
      );
      plan.ngOnInit();
      await vi.advanceTimersByTimeAsync(0);
      await settle();

      // Nothing re-planned behind the traveller's back: the dated line turns into the warning and
      // Refresh is theirs to press.
      expect(called()).toEqual(['getTripSnapshot']);
      expect(plan.snapshotShown()?.departureAt).toBe(iso(lastNight));
      expect(new Date(plan.departureAt()).getTime()).toBe(lastNight);
    });

    it('plans from now when Refresh is pressed', async () => {
      const lastNight = NOW - 10 * HOUR;
      staged = stagedTrip({ departureAt: iso(lastNight) });
      const plan = build();
      api['getTripSnapshot'].mockResolvedValue(
        singleSnapshot({ planned_at: iso(NOW - 20 * HOUR), departure_at: iso(lastNight) }),
      );
      plan.ngOnInit();
      await vi.advanceTimersByTimeAsync(0);

      plan.refresh();
      await vi.advanceTimersByTimeAsync(0);

      const sent = Date.parse(api['planTrip'].mock.calls[0][0].departure_at);
      expect(sent).toBeGreaterThanOrEqual(NOW - 60_000);
      expect(sent).toBeLessThan(NOW + 60_000);
    });
  });

  describe('when there is nothing usable to show, it plans as it always did', () => {
    it('re-plans a snapshot more than two days old, then stores the new one', async () => {
      staged = stagedTrip();
      const plan = build();
      api['getTripSnapshot'].mockResolvedValue(
        singleSnapshot({ planned_at: iso(NOW - 48 * HOUR - 60_000) }),
      );
      plan.ngOnInit();
      await vi.advanceTimersByTimeAsync(0);

      expect(api['planTrip']).toHaveBeenCalledTimes(1);
      expect(api['createBriefing']).toHaveBeenCalledTimes(1);
      expect(plan.snapshotShown()).toBeNull();
      expect(plan.plan()?.worst_severity).toBe('clear');

      await settle();
      expect(api['saveTrip']).toHaveBeenCalledTimes(1);
      expect(api['saveTripSnapshot']).toHaveBeenCalledTimes(1);
      const [, body] = api['saveTripSnapshot'].mock.calls[0];
      expect(body.planned_at).toBe(iso(NOW));
    });

    it('plans when the trip has no stored snapshot', async () => {
      staged = stagedTrip();
      const plan = build();
      api['getTripSnapshot'].mockRejectedValue(
        new ApiError(404, 'This trip has no stored result yet.', 'snapshot_not_found'),
      );
      plan.ngOnInit();
      await vi.advanceTimersByTimeAsync(0);

      expect(api['planTrip']).toHaveBeenCalledTimes(1);
      expect(plan.plan()).not.toBeNull();
      expect(plan.snapshotShown()).toBeNull();
      expect(plan.error()).toBeNull();
    });

    it.each([
      ['an unknown schema version', singleSnapshot({ schema_version: 2 })],
      ['a missing plan', singleSnapshot({ payload: { briefing: briefing() } })],
      ['a plan of the wrong shape', singleSnapshot({ payload: { plan: { samples: 'x' } } })],
      [
        'a briefing of the wrong kind',
        singleSnapshot({ payload: { plan: dayPlan(), briefing: tripBriefing() } }),
      ],
      ['an unknown kind', singleSnapshot({ kind: 'outlook' })],
    ])('plans on %s, and never shows half a result', async (_label, stored) => {
      staged = stagedTrip();
      const plan = build();
      api['getTripSnapshot'].mockResolvedValue(stored);
      plan.ngOnInit();
      await vi.advanceTimersByTimeAsync(0);

      expect(api['planTrip']).toHaveBeenCalledTimes(1);
      expect(plan.snapshotShown()).toBeNull();
      expect(plan.plan()?.worst_severity).toBe('clear');
      expect(plan.briefing()?.text).toBe('Fresh.');
    });

    it('plans for a guest, without asking for a snapshot', async () => {
      hasRealAccount = false;
      await open();
      expect(api['getTripSnapshot']).not.toHaveBeenCalled();
      expect(api['planTrip']).toHaveBeenCalledTimes(1);
    });
  });

  it('sends the traveller back to My Trips, saying why, when the trip is gone', async () => {
    api = {};
    staged = stagedTrip();
    const plan = build();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    api['getTripSnapshot'].mockRejectedValue(new ApiError(404, 'No such trip.', 'trip_not_found'));
    plan.ngOnInit();
    await vi.advanceTimersByTimeAsync(0);
    await settle();

    expect(navigate).toHaveBeenCalledWith(['/saved']);
    expect(notice.set).toHaveBeenCalledWith(expect.stringContaining("isn't in My Trips"));
    // Planning it would re-create it: the save is an upsert.
    expect(called()).toEqual(['getTripSnapshot']);
    expect(plan.loading()).toBe(false);
  });

  describe('Refresh and editing', () => {
    it('Refresh re-plans, clears the date, and stores the fresh result', async () => {
      const plan = await open();
      plan.refresh();
      await vi.advanceTimersByTimeAsync(0);

      expect(api['planTrip']).toHaveBeenCalledTimes(1);
      expect(api['createBriefing']).toHaveBeenCalledTimes(1);
      expect(plan.snapshotShown()).toBeNull();
      expect(plan.briefing()?.text).toBe('Fresh.');

      await settle();
      expect(api['saveTrip']).toHaveBeenCalledTimes(1);
      expect(api['saveTripSnapshot']).toHaveBeenCalledTimes(1);
      const [tripId, body] = api['saveTripSnapshot'].mock.calls[0];
      expect(tripId).toBe('trip-1');
      expect(body.trip_revision).toBe('rev-2');
      expect(body.payload.briefing.text).toBe('Fresh.');
    });

    it('Refresh sends the stored briefing as the re-brief baseline, so it can diff', async () => {
      const plan = await open();
      plan.refresh();
      await vi.advanceTimersByTimeAsync(0);
      // The saved trip's id is what the single-day re-brief diffs on (ADR-0039).
      expect(api['createBriefing'].mock.calls[0][0].trip_id).toBe('trip-1');
    });

    it('an edited stop re-plans the normal way and the date goes once the result is fresh', async () => {
      const plan = await open();
      plan.onStopsChange([newStop(STL, 30)]);
      expect(plan.snapshotShown()).not.toBeNull();
      await vi.advanceTimersByTimeAsync(500);

      expect(api['planTrip']).toHaveBeenCalledTimes(1);
      expect(api['createBriefing']).toHaveBeenCalledTimes(1);
      expect(plan.snapshotShown()).toBeNull();
    });
  });
});

/**
 * Planning a trip stores what was planned, so the next open — on any device — can show it.
 */
describe('Plan — a planned trip stores its result as the snapshot', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  function build(): Plan {
    api = {
      planTrip: vi.fn(async () => dayPlan()),
      planItinerary: vi.fn(async () => itinerary()),
      createBriefing: vi.fn(async () => briefing()),
      createItineraryBriefing: vi.fn(async () => tripBriefing()),
      saveTrip: vi.fn(async () => ({ id: 'trip-9', revision: 'rev-3' })),
      saveTripSnapshot: vi.fn(async () => undefined),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
        {
          provide: GeocodeService,
          useValue: { search: vi.fn(async () => []), reverse: vi.fn(async () => null) },
        },
        { provide: ApiService, useValue: api },
        { provide: EntitlementService, useValue: { refresh: vi.fn(async () => undefined) } },
        {
          provide: TripsService,
          useValue: { takeStaged: () => null, refresh: vi.fn(async () => undefined) },
        },
        { provide: AnalyticsService, useValue: { capture: vi.fn() } },
        { provide: PaywallService, useValue: { show: vi.fn() } },
        { provide: AuthService, useValue: { configured: () => true, hasRealAccount: () => true } },
        {
          provide: SettingsService,
          useValue: {
            units: () => 'imperial',
            home: () => null,
            work: () => null,
            setUnits: vi.fn(),
          },
        },
      ],
    });
    return TestBed.runInInjectionContext(() => new Plan());
  }

  let plan: Plan;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    plan = build();
    plan.origin.set(CHICAGO);
    plan.destination.set(DALLAS);
    plan.departureAt.set('2026-09-16T08:00');
  });
  afterEach(() => vi.useRealTimers());

  const settle = () => vi.advanceTimersByTimeAsync(2_500);

  it('PUTs the server bodies, unmodified, under the id and revision the save returned', async () => {
    await plan.submit();
    await settle();

    expect(api['saveTripSnapshot']).toHaveBeenCalledTimes(1);
    const [tripId, body] = api['saveTripSnapshot'].mock.calls[0];
    expect(tripId).toBe('trip-9');
    expect(body).toEqual({
      kind: 'single',
      schema_version: 1,
      planned_at: iso(NOW),
      departure_at: new Date('2026-09-16T08:00').toISOString(),
      trip_revision: 'rev-3',
      payload: { plan: dayPlan(), briefing: briefing() },
    });
  });

  it('stores a multi-day trip as an itinerary with its trip briefing', async () => {
    plan.stops.set([newStop(STL, 0, 2)]);
    await plan.submit();
    await settle();

    const [, body] = api['saveTripSnapshot'].mock.calls[0];
    expect(body.kind).toBe('itinerary');
    expect(body.payload).toEqual({ itinerary: itinerary(), briefing: tripBriefing() });
  });

  it('drops a 409 trip_changed silently and never retries it', async () => {
    api['saveTripSnapshot'].mockRejectedValue(
      new ApiError(409, 'This trip has changed since it was planned.', 'trip_changed'),
    );
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

    await plan.submit();
    await settle();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(api['saveTripSnapshot']).toHaveBeenCalledTimes(1);
    expect(plan.error()).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(plan.plan()).not.toBeNull();
  });

  it('stores nothing when the save returns no revision (an older server)', async () => {
    api['saveTrip'].mockResolvedValue({ id: 'trip-9' });
    await plan.submit();
    await settle();
    expect(api['saveTripSnapshot']).not.toHaveBeenCalled();
  });

  it('stores nothing when the form moved on before the save — the revision would not describe it', async () => {
    await plan.submit();
    // Typed, not submitted: the debounced save reads the form, and the result on screen is still
    // the Dallas one.
    plan.destination.set(STL);
    await settle();

    expect(api['saveTrip']).toHaveBeenCalledTimes(1);
    expect(api['saveTripSnapshot']).not.toHaveBeenCalled();
  });

  it('stores the scrubbed plan with the briefing already on screen', async () => {
    await plan.submit();
    api['planTrip'].mockResolvedValue(dayPlan({ worst_severity: 'severe' }));
    plan.onScrub({ target: { value: '60' } } as unknown as Event);
    await vi.advanceTimersByTimeAsync(400);
    await settle();

    expect(api['createBriefing']).toHaveBeenCalledTimes(1);
    const [, body] = api['saveTripSnapshot'].mock.calls.at(-1)!;
    expect(body.payload.plan.worst_severity).toBe('severe');
    expect(body.payload.briefing).toEqual(briefing());
    expect(body.departure_at).toBe(new Date(Date.parse('2026-09-16T08:00') + HOUR).toISOString());
  });
});
