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

const singleDayBriefing = {
  text: 'Clear the whole way.',
  facts: { overall_severity: 'clear', hazards: [] },
  model: 'template',
  claims: [],
};

const tripBriefingResponse = {
  text: '2 drives across 4 days. Day 2 is the one to watch.',
  model: 'template',
  generated_at: '2026-09-20T10:00:00Z',
  days: [
    { ordinal: 0, origin_name: DALLAS.name, destination_name: ABQ.name, severity: 'clear' },
    { ordinal: 1, origin_name: ABQ.name, destination_name: LA.name, beyond_forecast: true },
  ],
  rollup: {
    total_days: 4,
    total_nights: 3,
    total_distance_meters: 1_000_000,
    overall_severity: 'clear',
    days_with_forecast: 1,
    days_beyond_forecast: 1,
    days_failed: 0,
    partly_unknown: true,
  },
};

/**
 * Which briefing a trip gets, and what happens to the other one.
 *
 * The planner already plans a multi-day trip a day at a time; the briefing was the last surface
 * still narrating the whole thing from a single departure instant. The class is exercised directly
 * rather than rendered (as in plan-itinerary.spec.ts) — the template pulls in Leaflet, which does
 * not run in jsdom.
 */
describe('Plan — the briefing follows the shape of the trip', () => {
  let createBriefing: ReturnType<typeof vi.fn>;
  let createItineraryBriefing: ReturnType<typeof vi.fn>;
  let itineraryResponse: Record<string, unknown>;

  function build(): Plan {
    createBriefing = vi.fn(async () => singleDayBriefing);
    createItineraryBriefing = vi.fn(async () => tripBriefingResponse);
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
            planTrip: vi.fn(async () => dayPlan()),
            planItinerary: vi.fn(async () => itineraryResponse),
            createBriefing,
            createItineraryBriefing,
          },
        },
        { provide: EntitlementService, useValue: { refresh: vi.fn(async () => undefined) } },
        {
          provide: TripsService,
          useValue: { takeStaged: () => null, isSaved: () => false, recordRecent: vi.fn() },
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
      total_days: 4,
      total_nights: 3,
      worst_severity: 'clear',
      long_day_ordinals: [],
    };
    plan = build();
    plan.origin.set(DALLAS);
    plan.destination.set(LA);
    plan.departureAt.set(inDays(1));
  });

  it('leaves the one-day trip exactly as it was — /v1/briefings, and nothing else', async () => {
    plan.stops.set([newStop(ABQ, 45)]); // a lunch stop is not a travel day
    await plan.submit();
    expect(createBriefing).toHaveBeenCalledTimes(1);
    expect(createItineraryBriefing).not.toHaveBeenCalled();
    // The body is the one it always sent: a departure instant, the units, the stops.
    const body = createBriefing.mock.calls[0][0];
    expect(body.departure_at).toBeTruthy();
    expect(body.units).toBe('imperial');
    expect(plan.tripBriefing()).toBeNull();
    expect(plan.briefing()).not.toBeNull();
  });

  it('briefs a trip with an overnight stop day by day instead', async () => {
    plan.stops.set([newStop(ABQ, 0, 3, '09:30')]);
    await plan.submit();
    expect(createItineraryBriefing).toHaveBeenCalledTimes(1);
    expect(createBriefing).not.toHaveBeenCalled();
    // The SAME body the plan was asked for, so the two answers are about the same trip.
    expect(createItineraryBriefing.mock.calls[0][0].waypoints[0].nights).toBe(3);
    expect(plan.briefing()).toBeNull();
    expect(plan.tripBriefing()?.days).toHaveLength(2);
  });

  it('never shows both briefings at once, in either direction', async () => {
    plan.stops.set([newStop(ABQ, 0, 3, '09:30')]);
    await plan.submit();
    expect(plan.tripBriefing()).not.toBeNull();
    expect(plan.briefing()).toBeNull();

    // Take the night away and the trip is one drive again — the whole-trip paragraph must go with
    // it, not linger under a single-day timeline describing days that no longer exist.
    plan.stops.set([newStop(ABQ, 45)]);
    await plan.submit();
    expect(plan.briefing()).not.toBeNull();
    expect(plan.tripBriefing()).toBeNull();
  });

  it('keeps the plan and the briefing on the same reading of the trip', async () => {
    plan.stops.set([newStop(ABQ, 0, 3, '09:30')]);
    await plan.submit();
    // A whole-trip briefing next to a single-drive plan would be the contradiction rebuilt, with
    // both halves believing they were right.
    expect(!!plan.itinerary()).toBe(!!plan.tripBriefing());
    expect(!!plan.plan()).toBe(!!plan.briefing());
  });

  it('does not remember a whole-trip briefing as the next re-brief baseline', async () => {
    // The itinerary endpoint takes the planning body and returns no `facts` — there is nothing to
    // diff against, and inventing a baseline from a different shape would mislabel the next
    // single-day briefing's "Updated" badge.
    plan.stops.set([newStop(ABQ, 0, 3, '09:30')]);
    await plan.submit();
    plan.stops.set([newStop(ABQ, 45)]);
    await plan.submit();
    expect(createBriefing.mock.calls[0][0].previous_facts).toBeUndefined();
  });
});
