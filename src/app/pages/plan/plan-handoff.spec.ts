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
 * than rendered: `Plan`'s template pulls in `RouteMap`, and therefore `mapbox-gl`, which does not run
 * in jsdom.
 */
describe('Plan — landing-page ?from=&to= handoff', () => {
  let search: ReturnType<typeof vi.fn>;
  let planTrip: ReturnType<typeof vi.fn>;
  let getCurrentPosition: ReturnType<typeof vi.fn>;
  /** ADR-0025: only a REAL account may generate a briefing; an anonymous guest gets a 401. */
  let hasRealAccount = true;

  function build(params: Record<string, string>) {
    search = vi.fn(async (query: string) => {
      if (/chicago/i.test(query)) return [CHICAGO];
      if (/denver/i.test(query)) return [DENVER];
      return [];
    });
    planTrip = vi.fn(async () => ({
      distance_meters: 1_600_000,
      duration_seconds: 57_600,
      arrival_at: '2026-07-30T02:00:00Z',
      worst_severity: 'clear',
      samples: [],
    }));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(params) } } },
        { provide: GeocodeService, useValue: { search, reverse: vi.fn(async () => null) } },
        {
          provide: ApiService,
          useValue: { planTrip, createBriefing: vi.fn(async () => ({ facts: {}, claims: [] })) },
        },
        { provide: EntitlementService, useValue: { refresh: vi.fn(async () => undefined) } },
        {
          provide: TripsService,
          useValue: {
            takeStaged: () => null,
            isSaved: () => false,
            recordRecent: vi.fn(),
            toggleSave: vi.fn(),
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
          useValue: { units: () => 'imperial', home: () => null, work: () => null, setUnits: vi.fn() },
        },
      ],
    });
    return TestBed.runInInjectionContext(() => new Plan());
  }

  beforeEach(() => {
    hasRealAccount = true;
    getCurrentPosition = vi.fn();
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    vi.stubGlobal('isSecureContext', true);
  });

  afterEach(() => vi.restoreAllMocks());

  /** Let the two concurrent geocodes and the follow-on submit() settle. */
  const settle = () => new Promise((r) => setTimeout(r, 0));

  it('resolves both endpoints and runs the plan', async () => {
    const plan = build({ from: 'Chicago, IL', to: 'Denver, CO' });
    plan.ngOnInit();
    await settle();

    expect(search).toHaveBeenCalledWith('Chicago, IL');
    expect(search).toHaveBeenCalledWith('Denver, CO');
    expect(plan.origin()).toEqual(CHICAGO);
    expect(plan.destination()).toEqual(DENVER);
    expect(planTrip).toHaveBeenCalledTimes(1);
    expect(plan.plan()).toBeTruthy();
  });

  it('prefills but does NOT auto-plan for a guest — the CTA must not dead-end on /login', async () => {
    // Regression: auto-submitting for an anonymous session 401s (ADR-0025 §1 — a briefing needs a
    // REAL account), and submit()'s AccountRequiredError branch navigates to /login. A cold visitor
    // clicking the landing CTA therefore landed on a context-free sign-in page instead of the
    // planner. The wall belongs at Get briefing, not at the front door.
    hasRealAccount = false;
    const plan = build({ from: 'Chicago, IL', to: 'Denver, CO' });
    plan.ngOnInit();
    await settle();

    // Their route IS resolved and shown — they see the product with their own trip in it.
    expect(plan.origin()).toEqual(CHICAGO);
    expect(plan.destination()).toEqual(DENVER);
    // …but nothing is submitted, so nothing can 401 and redirect them away.
    expect(planTrip).not.toHaveBeenCalled();
    expect(plan.error()).toBeNull();
  });

  it('fills what it can and leaves the form when a lookup returns nothing', async () => {
    const plan = build({ from: 'Chicago, IL', to: 'Nowheresville, ZZ' });
    plan.ngOnInit();
    await settle();

    expect(plan.origin()).toEqual(CHICAGO);
    expect(plan.destination()).toBeNull();
    // No plan attempted, and crucially no error surfaced to someone who just clicked a CTA.
    expect(planTrip).not.toHaveBeenCalled();
    expect(plan.error()).toBeNull();
    // The user still gets the normal idle experience, geolocation prefill included.
    expect(getCurrentPosition).toHaveBeenCalled();
  });

  it('survives a geocoder outage without an error page or an unhandled rejection', async () => {
    const plan = build({ from: 'Chicago, IL', to: 'Denver, CO' });
    search.mockRejectedValue(new Error('geocoder down'));
    plan.ngOnInit();
    await settle();

    expect(plan.error()).toBeNull();
    expect(planTrip).not.toHaveBeenCalled();
    expect(plan.origin()).toBeNull();
    // Falls all the way back to the normal idle screen.
    expect(getCurrentPosition).toHaveBeenCalled();
  });

  it('starts empty with NO hardcoded demo route, and geolocates, when there are no params', async () => {
    const plan = build({});
    // ADR-0038 removed the San Francisco -> Los Angeles defaults.
    expect(plan.origin()).toBeNull();
    expect(plan.destination()).toBeNull();

    plan.ngOnInit();
    await settle();

    expect(search).not.toHaveBeenCalled();
    expect(planTrip).not.toHaveBeenCalled();
    expect(getCurrentPosition).toHaveBeenCalled();
  });

  it('does not let the geolocation prefill overwrite a handed-off origin', async () => {
    const plan = build({ from: 'Chicago, IL', to: 'Denver, CO' });
    plan.ngOnInit();
    await settle();
    // With both params resolved, the async location fix is never requested at all.
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(plan.origin()).toEqual(CHICAGO);
  });
});
