import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsService } from '../../core/analytics.service';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { EntitlementService } from '../../core/entitlement.service';
import { GeocodeService } from '../../core/geocode.service';
import { PaywallService } from '../../core/paywall.service';
import { SettingsService } from '../../core/settings.service';
import { TripsService } from '../../core/trips.service';
import { Plan } from './plan';
import { stopsSummaryLabel } from './stops-summary';
import { newStop } from './waypoints';

const CHICAGO = { name: 'Chicago, IL', latitude: 41.8781, longitude: -87.6298 };
const STL = { name: 'St. Louis, MO', latitude: 38.627, longitude: -90.1994 };
const KC = { name: 'Kansas City, MO', latitude: 39.0997, longitude: -94.5786 };
const DENVER = { name: 'Denver, CO', latitude: 39.7392, longitude: -104.9903 };

/**
 * The seam between the stops editor and the planner. The editor keeps a draft; Done hands it over,
 * and the planner must then behave exactly as it did when stops were edited inline — re-plan when
 * the waypoints changed, not when they did not, and auto-save the re-planned trip.
 *
 * The class is exercised directly rather than rendered, as in plan-autosave.spec.ts — the template
 * pulls in Leaflet, which does not run in jsdom.
 */
describe('Plan — stops editor Done', () => {
  let planTrip: ReturnType<typeof vi.fn>;
  let planItinerary: ReturnType<typeof vi.fn>;
  let saveTrip: ReturnType<typeof vi.fn>;

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
      days: [0, 1].map((ordinal) => ({
        ordinal,
        travel_date: null,
        nights_at_destination: 0,
        beyond_forecast: true,
        plan: null,
        error: null,
      })),
      worst_severity: null,
    }));
    saveTrip = vi.fn(async () => ({ id: 'trip-1' }));

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
        {
          provide: TripsService,
          useValue: { takeStaged: () => null, refresh: vi.fn(async () => undefined) },
        },
        { provide: AnalyticsService, useValue: { capture: vi.fn() } },
        { provide: PaywallService, useValue: { show: vi.fn() } },
        {
          provide: AuthService,
          useValue: { configured: () => true, hasRealAccount: () => true },
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
  beforeEach(async () => {
    vi.useFakeTimers();
    plan = build();
    plan.origin.set(CHICAGO);
    plan.destination.set(DENVER);
    plan.stops.set([newStop(STL, 30)]);
    await plan.submit();
    await vi.advanceTimersByTimeAsync(2_500); // let the first plan's auto-save go out
    planTrip.mockClear();
    planItinerary.mockClear();
    saveTrip.mockClear();
  });

  afterEach(() => vi.useRealTimers());

  it('closes the editor and re-plans the trip the draft now describes', async () => {
    plan.stopsEditorOpen.set(true);
    plan.onStopsEditorDone([{ ...plan.stops()[0], dwellMinutes: 0, nights: 2 }]);
    expect(plan.stopsEditorOpen()).toBe(false);

    await vi.advanceTimersByTimeAsync(500);
    // A night makes it two travel days, so the re-plan is the itinerary call.
    expect(planItinerary).toHaveBeenCalledTimes(1);
    const [waypoint] = planItinerary.mock.calls[0][0].waypoints;
    expect(waypoint.nights).toBe(2);
    // The chip said "8 AM" but nobody chose it: nothing is sent, so the server's default is the
    // hour the day is actually planned at.
    expect('departure_time' in waypoint).toBe(false);
    expect(plan.itinerary()).not.toBeNull();
  });

  it('auto-saves the re-planned trip, as an inline edit always did', async () => {
    plan.onStopsEditorDone([...plan.stops(), newStop(KC, 15)]);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(planTrip).toHaveBeenCalledTimes(1);
    expect(saveTrip).toHaveBeenCalledTimes(1);
    expect(saveTrip.mock.calls[0][0].waypoints.map((w: { name: string }) => w.name)).toEqual([
      STL.name,
      KC.name,
    ]);
  });

  it('does not re-plan when the editor was only looked at', async () => {
    plan.stopsEditorOpen.set(true);
    plan.onStopsEditorDone([...plan.stops()]);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(planTrip).not.toHaveBeenCalled();
    expect(planItinerary).not.toHaveBeenCalled();
    expect(saveTrip).not.toHaveBeenCalled();
  });

  it('sends a departure time the traveller picked', async () => {
    plan.onStopsEditorDone([
      { ...plan.stops()[0], dwellMinutes: 0, nights: 1, departureTime: '09:30' },
    ]);
    await vi.advanceTimersByTimeAsync(500);
    expect(planItinerary.mock.calls[0][0].waypoints[0].departure_time).toBe('09:30');
  });

  it('keeps the summary line current when Explore adds a stop', async () => {
    expect(stopsSummaryLabel(plan.stops())).toBe('1 stop · 1 day');
    plan.onExploreAddStop({ place: KC, dwellMinutes: 30 });
    expect(stopsSummaryLabel(plan.stops())).toBe('2 stops · 1 day');
    await vi.advanceTimersByTimeAsync(500);
    expect(planTrip).toHaveBeenCalledTimes(1);
  });
});
