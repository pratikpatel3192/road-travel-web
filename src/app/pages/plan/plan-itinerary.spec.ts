import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsService } from '../../core/analytics.service';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { EntitlementService } from '../../core/entitlement.service';
import { GeocodeService } from '../../core/geocode.service';
import { PaywallService } from '../../core/paywall.service';
import { SettingsService } from '../../core/settings.service';
import { TripsService } from '../../core/trips.service';
import { Plan } from './plan';
import { newStop } from './waypoints';

const DALLAS = { name: 'Dallas, TX', latitude: 32.7767, longitude: -96.797 };
const ABQ = { name: 'Albuquerque, NM', latitude: 35.0844, longitude: -106.6504 };
const LA = { name: 'Los Angeles, CA', latitude: 34.0522, longitude: -118.2437 };

/** A departure `n` days out, in the `datetime-local` wall clock the field actually holds. */
function inDays(n: number): string {
  const d = new Date(Date.now() + n * 86_400_000);
  const p = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T08:00`;
}

const dayPlan = (over: Record<string, unknown> = {}) => ({
  origin: DALLAS,
  destination: ABQ,
  departure_at: '2026-10-01T13:00:00Z',
  arrival_at: '2026-10-01T22:00:00Z',
  distance_meters: 1_000_000,
  duration_seconds: 9 * 3600,
  waypoints: [],
  total_dwell_seconds: 0,
  worst_severity: 'clear',
  route_coordinates: [],
  samples: [],
  segments: [],
  meta: { sample_count: 0, segment_count: 0, route_point_count: 0, provider_mode: 'mock' },
  ...over,
});

/**
 * The planner's choice of endpoint, and what the surfaces below the day list are showing.
 *
 * This is the seam the whole change turns on: a trip driven over more than one day is planned a day
 * at a time, and the ONE timeline and map below belong to a named day rather than to a fictional
 * single drive. The class is exercised directly rather than rendered (as in plan-handoff.spec.ts) —
 * the template pulls in Leaflet, which does not run in jsdom.
 */
describe('Plan — a multi-day trip is planned a day at a time', () => {
  let planTrip: ReturnType<typeof vi.fn>;
  let planItinerary: ReturnType<typeof vi.fn>;
  let saveTrip: ReturnType<typeof vi.fn>;
  let itineraryResponse: Record<string, unknown>;

  function build(): Plan {
    planTrip = vi.fn(async () => dayPlan());
    planItinerary = vi.fn(async () => itineraryResponse);
    saveTrip = vi.fn(async () => ({ id: 't1' }));
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
            createBriefing: vi.fn(async () => ({ facts: {}, claims: [] })),
            // A multi-day trip briefs through the itinerary endpoint (see
            // plan-trip-briefing.spec.ts); these cases are about the PLAN, so it answers with the
            // thinnest response that is still the right shape.
            createItineraryBriefing: vi.fn(async () => ({
              text: '',
              model: 'template',
              days: [],
              rollup: { days_with_forecast: 0, partly_unknown: false },
            })),
            saveTrip,
          },
        },
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
    itineraryResponse = {
      days: [
        {
          ordinal: 0,
          travel_date: '2026-10-01',
          nights_at_destination: 3,
          beyond_forecast: false,
          plan: dayPlan({ worst_severity: 'clear' }),
          error: null,
        },
        {
          ordinal: 1,
          travel_date: '2026-10-04',
          nights_at_destination: 0,
          beyond_forecast: false,
          plan: dayPlan({
            origin: ABQ,
            destination: LA,
            departure_at: '2026-10-04T15:30:00Z',
            worst_severity: 'severe',
            distance_meters: 1_200_000,
          }),
          error: null,
        },
      ],
      total_days: 4,
      total_nights: 3,
      worst_severity: 'severe',
      long_day_ordinals: [1],
    };
    plan = build();
    plan.origin.set(DALLAS);
    plan.destination.set(LA);
    plan.departureAt.set(inDays(1));
  });

  it('keeps a one-day trip on /plan, with no second call', async () => {
    plan.stops.set([newStop(ABQ, 45)]); // a lunch stop is not a travel day
    await plan.submit();
    expect(planTrip).toHaveBeenCalledTimes(1);
    expect(planItinerary).not.toHaveBeenCalled();
    expect(plan.itinerary()).toBeNull();
    expect(plan.shownPlan()).toBe(plan.plan());
  });

  it('plans a trip with an overnight stop day by day instead', async () => {
    plan.stops.set([newStop(ABQ, 0, 3, '09:30')]);
    await plan.submit();
    expect(planItinerary).toHaveBeenCalledTimes(1);
    expect(planTrip).not.toHaveBeenCalled();
    // The request carries the SAME waypoints /plan would have been sent, so the server derives the
    // days from the trip the screen is showing.
    expect(planItinerary.mock.calls[0][0].waypoints).toHaveLength(1);
    expect(planItinerary.mock.calls[0][0].waypoints[0].nights).toBe(3);
    expect(plan.plan()).toBeNull();
    expect(plan.itinerary()?.days).toHaveLength(2);
  });

  it("shows ONE day's route below, and says which day it is", async () => {
    plan.stops.set([newStop(ABQ, 0, 3, '09:30')]);
    await plan.submit();
    // Day 1 by default, and the timeline/map are reading that day's plan — not a fortnight fused
    // into one drive from one departure.
    expect(plan.selectedDay()).toBe(0);
    expect(plan.shownPlan()?.worst_severity).toBe('clear');
    expect(plan.shownDayHeading()).toContain('Day 1');
    expect(plan.shownDayHeading()).toContain('Dallas, TX → Albuquerque, NM');

    plan.onSelectDay(1);
    expect(plan.shownPlan()?.worst_severity).toBe('severe');
    expect(plan.shownDayHeading()).toContain('Day 2');
    expect(plan.shownDayHeading()).toContain('Albuquerque, NM → Los Angeles, CA');
    // The highlighted sample indexed into the OTHER day's route; carrying it over would point at
    // an unrelated place.
    expect(plan.selected()).toBeNull();
  });

  it("hands Explore the selected day's own departure and that day's stops", async () => {
    plan.stops.set([newStop(ABQ, 0, 3, '09:30')]);
    await plan.submit();
    plan.onSelectDay(1);
    expect(plan.exploreDepartureAt()).toBe('2026-10-04T15:30:00Z');
    expect(plan.exploreContext()?.origin.name).toBe(ABQ.name);
    // Albuquerque is where day 2 STARTS, so it is not a stop along day 2.
    expect(plan.exploreWaypoints()).toEqual([]);
  });

  it('treats a day past the horizon as an answer, not as an error', async () => {
    itineraryResponse = {
      ...itineraryResponse,
      days: [
        {
          ordinal: 0,
          travel_date: '2026-10-01',
          nights_at_destination: 3,
          beyond_forecast: false,
          plan: dayPlan(),
          error: null,
        },
        {
          ordinal: 1,
          travel_date: '2026-10-04',
          nights_at_destination: 0,
          beyond_forecast: true,
          plan: null,
          error: null,
        },
      ],
    };
    plan.stops.set([newStop(ABQ, 0, 3, '09:30')]);
    await plan.submit();
    plan.onSelectDay(1);
    expect(plan.shownPlan()).toBeNull();
    expect(plan.error()).toBeNull(); // the page's error banner must stay empty
    expect(plan.shownDayNote()).toContain('past the 10-day forecast');
    expect(plan.shownDayNote()).toContain('closer to the day');
  });

  it("says one day's route failed without claiming the trip did", async () => {
    itineraryResponse = {
      ...itineraryResponse,
      days: [
        {
          ordinal: 0,
          travel_date: '2026-10-01',
          nights_at_destination: 3,
          beyond_forecast: false,
          plan: dayPlan(),
          error: null,
        },
        {
          ordinal: 1,
          travel_date: '2026-10-04',
          nights_at_destination: 0,
          beyond_forecast: false,
          plan: null,
          error: 'Route exceeds the supported length.',
        },
      ],
    };
    plan.stops.set([newStop(ABQ, 0, 3, '09:30')]);
    await plan.submit();
    plan.onSelectDay(1);
    expect(plan.shownDayNote()).toContain('day 2');
    expect(plan.shownDayNote()).toContain('The other days are unaffected');
    expect(plan.error()).toBeNull();
    // Day 1's forecast survived and is still there to switch back to.
    plan.onSelectDay(0);
    expect(plan.shownPlan()).not.toBeNull();
  });

  it('opens on the first day there is something to show for', async () => {
    itineraryResponse = {
      ...itineraryResponse,
      days: [
        {
          ordinal: 0,
          travel_date: '2026-10-01',
          nights_at_destination: 3,
          beyond_forecast: true,
          plan: null,
          error: null,
        },
        {
          ordinal: 1,
          travel_date: '2026-10-04',
          nights_at_destination: 0,
          beyond_forecast: false,
          plan: dayPlan(),
          error: null,
        },
      ],
    };
    plan.stops.set([newStop(ABQ, 0, 3, '09:30')]);
    await plan.submit();
    // Landing on the blank day would read as the whole plan having failed.
    expect(plan.selectedDay()).toBe(1);
    expect(plan.shownPlan()).not.toBeNull();
  });

  it('auto-saves the WHOLE trip, not the day on screen', async () => {
    vi.useFakeTimers();
    try {
      plan.stops.set([newStop(ABQ, 0, 3, '09:30')]);
      await plan.submit();
      await vi.advanceTimersByTimeAsync(2000);
      const saved = saveTrip.mock.calls[0][0];
      expect(saved.distance_meters).toBe(2_200_000); // both days, summed
      expect(saved.worst_severity).toBe('severe'); // the itinerary's own worst
    } finally {
      vi.useRealTimers();
    }
  });
});
