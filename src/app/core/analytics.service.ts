import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

import { ConfigService } from './config';

/**
 * Product analytics (ADR-0037). One vendor across both clients: PostHog, with the SAME event names
 * the iOS app emits (`WeatherRoute/Core/Analytics/Analytics.swift`) so activation and paywall funnels
 * are one funnel, not two.
 *
 * **No PII** — same rule as the iOS sink. Events carry coarse, non-identifying values only: distance
 * buckets and trigger strings. Never a coordinate, a place name or a route endpoint. That rule also
 * constrains the automatic properties: PostHog's autocapture (which would record typed input values
 * and element text — i.e. place names) and session recording are OFF, and `$pageview` reports the
 * route PATH with the query string stripped, because `/plan?from=Chicago&to=Denver` is a place name.
 *
 * The project key is a publishable client-side value and arrives in the runtime `config.json` like
 * the Supabase anon key and the RevenueCat web key (ADR-0024), so dev/uat/prod can point at
 * different projects — or, with no key, at none: the service stays inert and the app is unaffected.
 */

/** The cross-platform taxonomy. Keep in lockstep with iOS `AnalyticsEvent.name`. */
export type AnalyticsEventName =
  | 'app_launched'
  | 'trip_planned'
  | 'trip_saved'
  | 'route_blocked_free_cap'
  | 'paywall_viewed'
  | 'purchase_completed'
  | 'purchase_restored';

/** Event properties. Mirrors the iOS `[String: String]` shape — coarse values, never PII. */
export type AnalyticsProperties = Record<string, string | number | boolean>;

type PostHogLike = {
  init: (key: string, options: Record<string, unknown>) => void;
  capture: (event: string, properties?: Record<string, unknown>) => void;
};

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly config = inject(ConfigService);
  private readonly router = inject(Router);

  private posthog: PostHogLike | null = null;
  private started = false;
  /** Events raised before the lazily-imported SDK lands; flushed in order once it does. */
  private readonly pending: { name: string; properties?: AnalyticsProperties }[] = [];

  /** Whether events are actually being sent (false when no key is configured). */
  get enabled(): boolean {
    return this.started;
  }

  /**
   * Initialise once, at bootstrap, AFTER `ConfigService.load()` (the key lives in config.json).
   * Deliberately NOT awaited: `posthog-js` is dynamically imported so it stays out of the initial
   * bundle and never delays first paint. Events raised in the meantime queue and flush on arrival.
   */
  init(): void {
    if (this.started) return;
    const key = this.config.value.posthogKey;
    if (!key) return; // no project configured for this environment — stay inert
    this.started = true;

    // Router-driven page views: an SPA has ONE page load and many route changes, so `$pageview`
    // is fired per NavigationEnd rather than by PostHog's own page-load hook.
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.capturePageView(e.urlAfterRedirects));

    void this.load(key);
  }

  private async load(key: string): Promise<void> {
    try {
      const mod = await import('posthog-js');
      const posthog = (mod.default ?? mod) as unknown as PostHogLike;
      posthog.init(key, {
        api_host: this.config.value.posthogHost || 'https://us.i.posthog.com',
        // We fire `$pageview` ourselves on router events (see init).
        capture_pageview: false,
        capture_pageleave: true,
        // No-PII rule: autocapture records clicked element text and input values — on this app that
        // is place names. Session recording is the same problem, larger.
        autocapture: false,
        disable_session_recording: true,
        // Product analytics only: no cross-site identity graph, so no consent banner is required
        // and (on iOS) no ATT prompt.
        persistence: 'localStorage+cookie',
        sanitize_properties: (properties: Record<string, unknown>) => sanitize(properties),
      });
      this.posthog = posthog;
      for (const queued of this.pending.splice(0)) {
        posthog.capture(queued.name, queued.properties);
      }
    } catch {
      // A blocked or failed CDN/bundle load must never break the app; events simply stop queueing.
      this.pending.length = 0;
      this.posthog = null;
    }
  }

  /** Emit a taxonomy event. A no-op when analytics are not configured. */
  capture(name: AnalyticsEventName, properties?: AnalyticsProperties): void {
    this.send(name, properties);
  }

  /** `$pageview` for one Angular navigation. The query string is dropped (it carries place names). */
  private capturePageView(urlAfterRedirects: string): void {
    this.send('$pageview', { $pathname: pathOf(urlAfterRedirects) });
  }

  private send(name: string, properties?: AnalyticsProperties): void {
    if (!this.started) return;
    if (this.posthog) this.posthog.capture(name, properties);
    else this.pending.push({ name, properties });
  }
}

/** The path of an Angular router URL, without query string or fragment. */
function pathOf(url: string): string {
  return url.split(/[?#]/)[0] || '/';
}

/**
 * Strip the query string and fragment from every URL property PostHog attaches automatically
 * (`$current_url`, `$referrer`, `$initial_current_url`, …). `/plan?from=Chicago,%20IL&to=Denver,%20CO`
 * is a place name, and place names are PII under this app's analytics rule.
 */
function sanitize(properties: Record<string, unknown>): Record<string, unknown> {
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value === 'string' && /url|referrer|pathname/i.test(key) && /[?#]/.test(value)) {
      properties[key] = value.split(/[?#]/)[0];
    }
  }
  return properties;
}
