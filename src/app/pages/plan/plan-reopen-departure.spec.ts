import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsService } from '../../core/analytics.service';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { EntitlementService } from '../../core/entitlement.service';
import { GeocodeService, type GeoResult } from '../../core/geocode.service';
import { PaywallService } from '../../core/paywall.service';
import { SettingsService } from '../../core/settings.service';
import { TripsService } from '../../core/trips.service';
import { Plan } from './plan';

const CHICAGO: GeoResult = { name: 'Chicago, IL', latitude: 41.8781, longitude: -87.6298 };
const DENVER: GeoResult = { name: 'Denver, CO', latitude: 39.7392, longitude: -104.9903 };

/**
 * ADR-0038: the static landing page's hero form hands off as `/plan?from=…&to=…`. The planner must
 * resolve both endpoints and start planning; a lookup that fails must degrade to a usable form, never
 * to an error page or a blank planner. Absent params, nothing about today's behaviour may change.
 *
 * The component class is exercised directly (via `TestBed.runInInjectionContext` + `ngOnInit`) rather
 * than rendered: `Plan`'s template pulls in `RouteMap`, and therefore Leaflet, which does not run
 * in jsdom.
 */
const DALLAS = { name: 'Dallas, TX', latitude: 32.7767, longitude: -96.797 };

/**
 * Opening a saved trip hands the planner the departure the trip was saved with. That moment can have
 * passed: a trip saved last night at 8:45 PM was re-planned this morning for 8:45 PM LAST NIGHT, and
 * because a forecast only starts at the current hour, its whole first day read "past the 10-day
 * forecast" with a dashed, weatherless route — on a trip the traveller was planning for today.
 */
describe('Plan — reopening a saved trip whose departure has passed', () => {
  function build(departureAt: string, staged = true) {
    const planTrip = vi.fn(async () => ({
      distance_meters: 1_600_000,
      duration_seconds: 57_600,
      arrival_at: '2099-01-01T00:00:00Z',
      worst_severity: 'clear',
      samples: [],
    }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
        { provide: GeocodeService, useValue: { search: vi.fn(async () => []), reverse: vi.fn(async () => null) } },
        {
          provide: ApiService,
          useValue: {
            planTrip,
            createBriefing: vi.fn(async () => ({ facts: {}, claims: [] })),
            saveTrip: vi.fn(async () => ({ id: 't1' })),
          },
        },
        { provide: EntitlementService, useValue: { refresh: vi.fn(async () => undefined) } },
        {
          provide: TripsService,
          useValue: {
            takeStaged: () =>
              staged
                ? {
                    origin: CHICAGO,
                    destination: DALLAS,
                    departureAt,
                    waypoints: [],
                    savedTripId: 'saved-1',
                  }
                : null,
            refresh: vi.fn(async () => undefined),
          },
        },
        { provide: AnalyticsService, useValue: { capture: vi.fn() } },
        { provide: PaywallService, useValue: { show: vi.fn() } },
        { provide: AuthService, useValue: { configured: () => true, hasRealAccount: () => true } },
        {
          provide: SettingsService,
          useValue: { units: () => 'imperial', home: () => null, work: () => null, setUnits: vi.fn() },
        },
      ],
    });
    return { plan: TestBed.runInInjectionContext(() => new Plan()), planTrip };
  }

  beforeEach(() => {
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: vi.fn() } });
    vi.stubGlobal('isSecureContext', true);
  });
  afterEach(() => vi.restoreAllMocks());

  it('replaces a departure that has already gone with a future one', () => {
    const lastNight = new Date(Date.now() - 20 * 3_600_000).toISOString();
    const { plan } = build(lastNight);
    plan.ngOnInit();
    expect(new Date(plan.departureAt()).getTime()).toBeGreaterThan(Date.now());
  });

  it('keeps a departure that is still ahead, exactly as saved', () => {
    const nextWeek = new Date(Date.now() + 7 * 24 * 3_600_000);
    nextWeek.setSeconds(0, 0);
    const { plan } = build(nextWeek.toISOString());
    plan.ngOnInit();
    expect(new Date(plan.departureAt()).getTime()).toBe(nextWeek.getTime());
  });

  it('plans a departure that went stale while the page sat open from now, and shows it', async () => {
    // The field defaults to an hour after the page loaded; two hours later that is in the past.
    const { plan, planTrip } = build('', false);
    plan.ngOnInit();
    plan.origin.set(CHICAGO);
    plan.destination.set(DALLAS);
    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000);
    plan.departureAt.set(`${twoHoursAgo.getFullYear()}-${String(twoHoursAgo.getMonth() + 1).padStart(2, '0')}-${String(twoHoursAgo.getDate()).padStart(2, '0')}T${String(twoHoursAgo.getHours()).padStart(2, '0')}:${String(twoHoursAgo.getMinutes()).padStart(2, '0')}`);

    await plan.submit();

    const sent = new Date((planTrip.mock.calls as unknown as [{ departure_at: string }][])[0][0].departure_at);
    expect(Date.now() - sent.getTime()).toBeLessThan(90_000);
    expect(new Date(plan.departureAt()).getTime()).toBe(sent.getTime());
  });
});
