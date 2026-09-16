import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsService } from '../../core/analytics.service';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { EntitlementService } from '../../core/entitlement.service';
import { GeocodeService } from '../../core/geocode.service';
import { PaywallService } from '../../core/paywall.service';
import { SettingsService } from '../../core/settings.service';
import { type StagedTrip, TripsService } from '../../core/trips.service';
import { TOUR_STORAGE_KEY, TourService } from '../../tour/tour.service';
import { Settings } from '../settings/settings';
import { Plan } from './plan';

const CHICAGO = { name: 'Chicago, IL', latitude: 41.8781, longitude: -87.6298 };
const DENVER = { name: 'Denver, CO', latitude: 39.7392, longitude: -104.9903 };

/**
 * When the planner starts the first-run tour — and, more to the point, when it must not.
 *
 * Driven through the component class like the other planner specs (the template pulls in Leaflet,
 * which jsdom can't run). `TourService.start` is spied on: whether the tour can find its elements
 * is the overlay's business and has its own spec; this is about the planner's decision.
 */
describe('Plan — first-run tour', () => {
  let staged: StagedTrip | null;
  let params: Record<string, string>;
  let signedIn: boolean;
  let paywallPayload: ReturnType<typeof signal<unknown>>;
  let tour: TourService;
  let start: ReturnType<typeof vi.spyOn>;

  function build(): Plan {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(params) } },
        },
        {
          provide: GeocodeService,
          useValue: {
            search: vi.fn(async (q: string) => (/chicago/i.test(q) ? [CHICAGO] : [DENVER])),
            reverse: vi.fn(async () => null),
          },
        },
        {
          provide: ApiService,
          // Never resolves: a staged trip's plan stays "in flight" for the length of the test.
          useValue: {
            planTrip: vi.fn(() => new Promise(() => undefined)),
            getTripSnapshot: vi.fn(() => new Promise(() => undefined)),
          },
        },
        { provide: EntitlementService, useValue: { refresh: vi.fn(async () => undefined) } },
        {
          provide: TripsService,
          useValue: { takeStaged: () => staged, refresh: vi.fn(async () => undefined) },
        },
        { provide: AnalyticsService, useValue: { capture: vi.fn() } },
        { provide: PaywallService, useValue: { show: vi.fn(), payload: paywallPayload } },
        {
          provide: AuthService,
          useValue: { configured: () => true, hasRealAccount: () => signedIn },
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
    tour = TestBed.inject(TourService);
    // Pretend every target is on screen, and let the real sequencing run.
    const real = tour.start.bind(tour);
    start = vi
      .spyOn(tour, 'start')
      .mockImplementation((o) => real({ ...o, isRendered: () => true }));
    return TestBed.runInInjectionContext(() => new Plan());
  }

  /** ngOnInit, the first render, and the settle delay. */
  async function visit(plan: Plan): Promise<void> {
    plan.ngOnInit();
    plan.ngAfterViewInit();
    await vi.advanceTimersByTimeAsync(Plan.TOUR_SETTLE_MS + 10);
  }

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    staged = null;
    params = {};
    signedIn = false;
    paywallPayload = signal<unknown>(null);
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: vi.fn() } });
    vi.stubGlobal('isSecureContext', true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('starts on a plain first visit, once the page has settled — not before', async () => {
    const plan = build();
    plan.ngOnInit();
    plan.ngAfterViewInit();
    await vi.advanceTimersByTimeAsync(Plan.TOUR_SETTLE_MS - 100);
    expect(start).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(start).toHaveBeenCalledWith({ signedIn: false, force: false });
    expect(tour.active()).toBe(true);
    expect(tour.index()).toBe(0);
  });

  it('shows once: a finished tour does not come back on the next visit', async () => {
    await visit(build());
    tour.complete();
    await visit(build());
    expect(tour.active()).toBe(false);
    expect(localStorage.getItem(TOUR_STORAGE_KEY)).toBeTruthy();
  });

  it('does not start when storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    await visit(build());
    expect(start).not.toHaveBeenCalled();
    expect(tour.active()).toBe(false);
  });

  it('does not start over a landing-page handoff', async () => {
    params = { from: 'Chicago, IL', to: 'Denver, CO' };
    await visit(build());
    expect(start).not.toHaveBeenCalled();
  });

  it('does not start over a trip opened from My Trips', async () => {
    signedIn = true;
    staged = {
      origin: CHICAGO,
      destination: DENVER,
      waypoints: [],
      departureAt: '',
      savedTripId: 't1',
    } as unknown as StagedTrip;
    await visit(build());
    expect(start).not.toHaveBeenCalled();
  });

  it('does not start while the stops editor is open', async () => {
    const plan = build();
    plan.ngOnInit();
    plan.ngAfterViewInit();
    plan.stopsEditorOpen.set(true);
    await vi.advanceTimersByTimeAsync(Plan.TOUR_SETTLE_MS + 10);
    expect(tour.active()).toBe(false);
  });

  it('does not start while a plan is in flight', async () => {
    const plan = build();
    plan.ngOnInit();
    plan.ngAfterViewInit();
    plan.loading.set(true);
    await vi.advanceTimersByTimeAsync(Plan.TOUR_SETTLE_MS + 10);
    expect(tour.active()).toBe(false);
  });

  it('does not start under the paywall, or under any other open dialog', async () => {
    paywallPayload.set({ reason: 'x' });
    await visit(build());
    expect(tour.active()).toBe(false);

    paywallPayload.set(null);
    const dialog = document.createElement('div');
    dialog.setAttribute('aria-modal', 'true');
    document.body.appendChild(dialog);
    try {
      await visit(build());
      expect(tour.active()).toBe(false);
    } finally {
      dialog.remove();
    }
    // And nothing was recorded — it gets its chance on the next visit.
    expect(tour.status()).toBe('pending');
  });

  it('ends with Sign in for a guest and Settings when signed in', async () => {
    await visit(build());
    expect(tour.steps().at(-1)?.title).toBe('Start your free trial');
    tour.complete();

    localStorage.clear();
    signedIn = true;
    await visit(build());
    expect(tour.steps().at(-1)?.title).toBe('Settings');
  });

  it('leaving the planner mid-tour counts as seen, and cancels a pending start', async () => {
    const plan = build();
    await visit(plan);
    expect(tour.active()).toBe(true);
    TestBed.resetTestingModule(); // destroys the injector the planner was built in
    expect(tour.status()).toBe('done');

    localStorage.clear();
    const next = build();
    next.ngOnInit();
    next.ngAfterViewInit();
    const t = tour;
    TestBed.resetTestingModule();
    await vi.advanceTimersByTimeAsync(Plan.TOUR_SETTLE_MS + 10);
    expect(t.active()).toBe(false);
  });

  it('Settings → Show app tour navigates to the planner, which starts at step 1 despite completion', async () => {
    signedIn = true;
    const plan = build();
    tour.complete(); // no-op: nothing active
    localStorage.setItem(TOUR_STORAGE_KEY, 'done-earlier');

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const settings = TestBed.runInInjectionContext(() => {
      // Settings' other dependencies are irrelevant to this button.
      const s = Object.create(Settings.prototype) as Settings;
      Object.assign(s, { tour, router: TestBed.inject(Router) });
      return s;
    });
    settings.replayTour();
    expect(navigate).toHaveBeenCalledWith(['/plan']);

    await visit(plan);
    expect(start).toHaveBeenCalledWith({ signedIn: true, force: true });
    expect(tour.active()).toBe(true);
    expect(tour.index()).toBe(0);
    expect(tour.step()?.title).toBe('Start here');

    // ...and the request is spent: a later ordinary visit does not replay.
    tour.complete();
    await visit(build());
    expect(tour.active()).toBe(false);
  });
});
