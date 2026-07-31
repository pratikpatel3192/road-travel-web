import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsService } from './analytics.service';
import { ConfigService } from './config';

const captured: { name: string; properties?: Record<string, unknown> }[] = [];
let initArgs: { key: string; options: Record<string, unknown> } | null = null;

vi.mock('posthog-js', () => ({
  default: {
    init: (key: string, options: Record<string, unknown>) => {
      initArgs = { key, options };
    },
    capture: (name: string, properties?: Record<string, unknown>) => {
      captured.push({ name, properties });
    },
  },
}));

/**
 * ADR-0037: one taxonomy across both clients, page views driven by the Angular router (an SPA has
 * one page load and many route changes), and NO PII in any property — place names ride in the query
 * string, so URLs are captured path-only.
 */
describe('AnalyticsService', () => {
  const configWith = (over: Record<string, string> = {}) => ({
    value: { posthogKey: '', posthogHost: '', ...over },
  });

  function make(config: ReturnType<typeof configWith>) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        // Component-less stand-ins for the real routes — this spec exercises the router *events*,
        // not the pages.
        provideRouter([
          { path: 'plan', children: [] },
          { path: 'settings', children: [] },
        ]),
        { provide: ConfigService, useValue: config },
      ],
    });
    return TestBed.inject(AnalyticsService);
  }

  beforeEach(() => {
    captured.length = 0;
    initArgs = null;
  });

  afterEach(() => vi.restoreAllMocks());

  it('stays inert when no project key is configured', async () => {
    const analytics = make(configWith());
    analytics.init();
    analytics.capture('app_launched');
    await Promise.resolve();
    expect(analytics.enabled).toBe(false);
    expect(initArgs).toBeNull();
    expect(captured).toEqual([]);
  });

  it('queues events raised before the lazily-imported SDK lands, then flushes them in order', async () => {
    const analytics = make(configWith({ posthogKey: 'phc_test' }));
    analytics.init();
    // The dynamic import has not resolved yet — nothing can have been sent.
    analytics.capture('app_launched');
    expect(captured).toEqual([]);
    expect(analytics.enabled).toBe(true);

    await new Promise((r) => setTimeout(r, 0)); // let the dynamic import settle
    analytics.capture('trip_planned', { distance_mi: 212 });

    expect(captured.map((c) => c.name)).toEqual(['app_launched', 'trip_planned']);
    expect(captured[1].properties).toEqual({ distance_mi: 212 });
  });

  it('disables autocapture, session recording and PostHog’s own pageview hook', async () => {
    const analytics = make(configWith({ posthogKey: 'phc_test' }));
    analytics.init();
    await new Promise((r) => setTimeout(r, 0));
    expect(initArgs!.key).toBe('phc_test');
    // Autocapture would record typed input values and element text — i.e. place names.
    expect(initArgs!.options['autocapture']).toBe(false);
    expect(initArgs!.options['disable_session_recording']).toBe(true);
    // We fire $pageview per NavigationEnd instead.
    expect(initArgs!.options['capture_pageview']).toBe(false);
  });

  it('fires one $pageview per router navigation, with the query string stripped', async () => {
    const analytics = make(configWith({ posthogKey: 'phc_test' }));
    analytics.init();
    await new Promise((r) => setTimeout(r, 0));
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/plan?from=Chicago,%20IL&to=Denver,%20CO');
    await router.navigateByUrl('/settings');

    const pageviews = captured.filter((c) => c.name === '$pageview');
    expect(pageviews.map((p) => p.properties?.['$pathname'])).toEqual(['/plan', '/settings']);
    // The endpoints the user typed must not reach the analytics vendor.
    expect(JSON.stringify(pageviews)).not.toContain('Chicago');
  });

  it('strips the query string from PostHog’s automatic URL properties', async () => {
    const analytics = make(configWith({ posthogKey: 'phc_test' }));
    analytics.init();
    await new Promise((r) => setTimeout(r, 0));
    const sanitize = initArgs!.options['sanitize_properties'] as (
      p: Record<string, unknown>,
    ) => Record<string, unknown>;

    const cleaned = sanitize({
      $current_url: 'https://roadtravel.info/plan?from=Chicago,%20IL&to=Denver,%20CO',
      $referrer: 'https://roadtravel.info/?utm_source=reddit',
      distance_mi: 212,
    });

    expect(cleaned['$current_url']).toBe('https://roadtravel.info/plan');
    expect(cleaned['$referrer']).toBe('https://roadtravel.info/');
    expect(cleaned['distance_mi']).toBe(212); // non-URL properties pass through untouched
  });
});
