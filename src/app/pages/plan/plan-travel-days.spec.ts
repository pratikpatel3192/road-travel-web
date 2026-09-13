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

/**
 * The planner's own wiring between the stop rows and the derived days. The derivation itself is
 * pinned by the shared vectors (core/itinerary-vectors.spec.ts); what is asserted here is the seam:
 * the days come from the SAME waypoints the request carries, and the `datetime-local` field is read
 * as the local day it already is.
 *
 * The class is exercised directly rather than rendered, as in plan-handoff.spec.ts — the template
 * pulls in Leaflet, which does not run in jsdom.
 */
describe('Plan — days derived from the stops', () => {
  function build() {
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
        { provide: ApiService, useValue: { planTrip: vi.fn(), createBriefing: vi.fn() } },
        { provide: EntitlementService, useValue: { refresh: vi.fn(async () => undefined) } },
        {
          provide: TripsService,
          useValue: { takeStaged: () => null, isSaved: () => false, recordRecent: vi.fn() },
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
  beforeEach(() => {
    plan = build();
    plan.origin.set(DALLAS);
    plan.destination.set(LA);
    plan.departureAt.set('2026-10-01T08:00');
  });

  it('derives nothing until both endpoints are picked', () => {
    plan.destination.set(null);
    expect(plan.travelDays()).toEqual([]);
  });

  it('is one day until a stop has a night', () => {
    plan.stops.set([newStop(ABQ, 45)]);
    expect(plan.travelDays()).toHaveLength(1);
    expect(plan.travelDays()[0].destination.name).toBe(LA.name);
  });

  it('splits into dated days the moment a stop takes nights', () => {
    plan.stops.set([newStop(ABQ, 0, 3, '09:30')]);
    const days = plan.travelDays();
    expect(days).toHaveLength(2);
    expect(days[0].travelDate).toBe('2026-10-01');
    expect(days[0].departureTime).toBe('08:00'); // the trip's own departure
    expect(days[0].nightsAtDestination).toBe(3);
    // One day to drive it plus three nights there.
    expect(days[1].travelDate).toBe('2026-10-05');
    expect(days[1].departureTime).toBe('09:30'); // the stop's own morning
  });

  it('reads the departure field as the local day it already is', () => {
    // Regression guard: `new Date('2026-10-01T08:00')` then formatting in UTC lands on the 1st only
    // east of Greenwich — a traveller in Dallas would see their first day dated the 30th.
    plan.stops.set([newStop(ABQ, 0, 1)]);
    expect(plan.travelDays()[0].travelDate).toBe('2026-10-01');
  });

  it('derives undated days when the departure field is empty, rather than assuming today', () => {
    plan.departureAt.set('');
    plan.stops.set([newStop(ABQ, 0, 2)]);
    expect(plan.travelDays().map((d) => d.travelDate)).toEqual([null, null]);
  });
});
