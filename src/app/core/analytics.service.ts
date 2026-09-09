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

/**
 * The cross-platform taxonomy. Keep in lockstep with iOS `AnalyticsEvent.name`.
 *
 * `referral_captured` (ADR-0045) is **web-only**, like `purchase_restored` is iOS-only: the
 * referral path exists only on the web, because Apple passes no install referrer and there is no
 * iOS equivalent of the Play Install Referrer. There is nothing for the iOS taxonomy to mirror.
 */
export type AnalyticsEventName =
  | 'app_launched'
  | 'trip_planned'
  | 'trip_saved'
  | 'route_blocked_free_cap'
  | 'paywall_viewed'
  | 'purchase_completed'
  | 'purchase_restored'
  | 'referral_captured';

/** Event properties. Mirrors the iOS `[String: String]` shape — coarse values, never PII. */
export type AnalyticsProperties = Record<string, string | number | boolean>;

type PostHogLike = {
  init: (key: string, options: Record<string, unknown>) => void;
  capture: (event: string, properties?: Record<string, unknown>) => void;
  register: (properties: Record<string, unknown>) => void;
};

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly config = inject(ConfigService);
  private readonly router = inject(Router);

  private posthog: PostHogLike | null = null;
  private started = false;
  /** Events raised before the lazily-imported SDK lands; flushed in order once it does. */
  private readonly pending: { name: string; properties?: AnalyticsProperties }[] = [];
  /** Super properties, held until the SDK lands so they apply to the queued events too. */
  private readonly superProperties: AnalyticsProperties = {};

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
      // Register BEFORE the flush, so events raised during startup — `app_launched` and
      // `referral_captured` both are — carry the super properties too. Registering after would
      // attribute the whole first burst to nobody.
      if (Object.keys(this.superProperties).length) posthog.register(this.superProperties);
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

  /**
   * ADR-0045: attach the referring creator to EVERY subsequent event, including the ones PostHog
   * raises itself (`$pageleave`).
   *
   * A super property rather than a property on one event, because the question a creator payout
   * conversation actually asks is not "how many people clicked" but "how does this creator's
   * traffic convert" — which needs the slug on `paywall_viewed` and `purchase_completed`, not on
   * the capture event. The database remains authoritative for who gets paid; this is the funnel
   * around that number.
   *
   * Safe to call before {@link init}: the value is held and registered when the SDK lands.
   *
   * NOT PII, and not an `identify()`. It is a marketing label for the link the visitor arrived on,
   * carries nothing about the person, and creates no link to the Supabase account — so ADR-0037's
   * `Linked = false` privacy posture and its no-consent-banner story are both unaffected.
   */
  attachReferral(slug: string | null): void {
    if (!slug) return;
    // Deliberately NOT named `*referrer*`: `sanitize()` below splits any property whose KEY matches
    // /url|referrer|pathname/i on `?` or `#`. A slug contains neither so it would survive today,
    // but the name would be sitting inside a trap. `referral_slug` mirrors `public.users.referred_by`.
    this.superProperties['referral_slug'] = slug;
    this.posthog?.register({ referral_slug: slug });
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
