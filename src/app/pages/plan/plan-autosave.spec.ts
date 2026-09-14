import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsService } from '../../core/analytics.service';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { EntitlementService } from '../../core/entitlement.service';
import { AccountRequiredError } from '../../core/errors';
import { GeocodeService } from '../../core/geocode.service';
import { PaywallService } from '../../core/paywall.service';
import { SettingsService } from '../../core/settings.service';
import { TripsService } from '../../core/trips.service';
import { Plan } from './plan';
import { newStop } from './waypoints';

const CHICAGO = { name: 'Chicago, IL', latitude: 41.8781, longitude: -87.6298 };
const STL = { name: 'St. Louis, MO', latitude: 38.627, longitude: -90.1994 };
const DENVER = { name: 'Denver, CO', latitude: 39.7392, longitude: -104.9903 };

/**
 * Planning a trip is what puts it in My Trips.
 *
 * This is the regression these tests exist for: the web client wrote every planned trip to a
 * DEVICE-LOCAL "recent" list and only ever reached `POST /v1/trips` when the traveller pressed a
 * star, which in thirty days of production nobody did. Two device-local histories that looked like
 * one synced list.
 *
 * The other half is that the save is BACKGROUND work. Nobody asked for it, so a failure — the 401 a
 * signed-out session gets above all — must not move anything on screen. A redirect to /login here
 * would be the planner losing the trip they are reading to a feature meant to keep it.
 *
 * The component class is exercised directly rather than rendered: `Plan`'s template pulls in
 * Leaflet, which does not run in jsdom.
 */
describe('Plan — planning a trip saves it', () => {
  let planTrip: ReturnType<typeof vi.fn>;
  let planItinerary: ReturnType<typeof vi.fn>;
  let saveTrip: ReturnType<typeof vi.fn>;
  let refresh: ReturnType<typeof vi.fn>;
  let hasRealAccount = true;

  function build(): Plan {
    planTrip = vi.fn(async () => ({
      origin: CHICAGO,
      destination: DENVER,
      departure_at: '2026-10-01T13:00:00Z',
      arrival_at: '2026-10-02T02:00:00Z',
      distance_meters: 1_600_000,
      duration_seconds: 57_600,
      waypoints: [],
      total_dwell_seconds: 0,
      worst_severity: 'caution',
      route_coordinates: [],
      samples: [],
      segments: [],
      meta: { sample_count: 0, segment_count: 0, route_point_count: 0, provider_mode: 'mock' },
    }));
    planItinerary = vi.fn(async () => ({
      days: [
        {
          ordinal: 0,
          travel_date: '2026-10-01',
          nights_at_destination: 2,
          beyond_forecast: false,
          plan: null,
          error: null,
        },
      ],
      worst_severity: 'caution',
    }));
    saveTrip = vi.fn(async () => ({ id: 'trip-1' }));
    refresh = vi.fn(async () => undefined);

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
        {
          provide: ApiService,
          useValue: {
            planTrip,
            planItinerary,
            saveTrip,
            createBriefing: vi.fn(async () => ({ facts: {}, claims: [] })),
            createItineraryBriefing: vi.fn(async () => ({
              text: '',
              model: 'template',
              days: [],
              rollup: { days_with_forecast: 0, partly_unknown: false },
            })),
          },
        },
        { provide: EntitlementService, useValue: { refresh: vi.fn(async () => undefined) } },
        { provide: TripsService, useValue: { takeStaged: () => null, refresh } },
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

  let plan: Plan;
  beforeEach(() => {
    hasRealAccount = true;
    vi.useFakeTimers();
    plan = build();
    plan.origin.set(CHICAGO);
    plan.destination.set(DENVER);
  });

  afterEach(() => vi.useRealTimers());

  /** Past the debounce window, with every promise the save chains on it settled. */
  const settleDebounce = () => vi.advanceTimersByTimeAsync(2_500);

  it('saves the planned trip to the server, whole-trip totals and all', async () => {
    plan.stops.set([newStop(STL, 30)]);
    await plan.submit();
    await settleDebounce();

    expect(saveTrip).toHaveBeenCalledTimes(1);
    const body = saveTrip.mock.calls[0][0];
    expect(body.origin).toEqual(CHICAGO);
    expect(body.destination).toEqual(DENVER);
    expect(body.distance_meters).toBe(1_600_000);
    expect(body.duration_seconds).toBe(57_600);
    expect(body.worst_severity).toBe('caution');
    expect(body.waypoints).toEqual([
      { name: STL.name, latitude: STL.latitude, longitude: STL.longitude, dwell_minutes: 30 },
    ]);
  });

  it('saves the stops that make a trip multi-day, nights and all', async () => {
    // The itinerary path, which is a different request and a different response shape. Without the
    // nights, a trip re-opened from My Trips comes back as one long drive.
    plan.stops.set([newStop(STL, 0, 2, '09:00')]);
    await plan.submit();
    await settleDebounce();

    expect(planItinerary).toHaveBeenCalledTimes(1);
    expect(saveTrip).toHaveBeenCalledTimes(1);
    expect(saveTrip.mock.calls[0][0].waypoints).toEqual([
      {
        name: STL.name,
        latitude: STL.latitude,
        longitude: STL.longitude,
        dwell_minutes: 0,
        nights: 2,
        departure_time: '09:00',
      },
    ]);
  });

  it('refreshes My Trips once the server has the trip', async () => {
    await plan.submit();
    await settleDebounce();
    // Not a locally-appended row: the server assigns the id and the legs, and the list is ordered
    // by last-planned, which only the server knows.
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('waits for the editing to stop — a re-plan per keystroke is not a POST per keystroke', async () => {
    await plan.submit();
    await vi.advanceTimersByTimeAsync(1_000);
    await plan.submit();
    await settleDebounce();

    // The endpoint is an idempotent upsert, so this is about volume rather than correctness — but
    // the planner re-plans on every stop edit and every nudge of the departure scrubber.
    expect(saveTrip).toHaveBeenCalledTimes(1);
  });

  it('sends nothing for a signed-out planner', async () => {
    hasRealAccount = false;
    plan = build();
    plan.origin.set(CHICAGO);
    plan.destination.set(DENVER);

    await plan.submit();
    await settleDebounce();

    // Saving needs a real account (ADR-0025), so a guest's plan is theirs to look at. Skipped
    // silently: there is nothing here the traveller asked for and nothing to apologise for.
    expect(saveTrip).not.toHaveBeenCalled();
    expect(plan.error()).toBeNull();
  });

  it('fails invisibly when the server rejects the save', async () => {
    saveTrip.mockRejectedValue(new AccountRequiredError());
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

    await plan.submit();
    await settleDebounce();

    expect(saveTrip).toHaveBeenCalledTimes(1);
    // The three things that must NOT happen: an error banner over a briefing the traveller is
    // reading, a bounce to /login for a save they never asked for, and the plan itself vanishing.
    expect(plan.error()).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(plan.plan()).not.toBeNull();
  });
});
