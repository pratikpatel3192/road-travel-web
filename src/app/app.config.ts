import {
  type ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { AnalyticsService } from './core/analytics.service';
import { AuthService } from './core/auth.service';
import { ApiService } from './core/api.service';
import { AttributionService } from './core/attribution.service';
import { ConfigService } from './core/config';
import { ReferralService } from './core/referral.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    // Load per-env config, then initialize Supabase auth, before the app renders.
    // NB: resolve every `inject()` synchronously BEFORE the first `await` — the injection context is
    // only available synchronously; calling `inject()` after an `await` throws NG0203 (which would
    // reject the initializer and blank the app). Guard so a startup hiccup never blocks rendering.
    provideAppInitializer(async () => {
      const config = inject(ConfigService);
      const auth = inject(AuthService);
      const analytics = inject(AnalyticsService);
      const referral = inject(ReferralService);
      const attribution = inject(AttributionService);
      const api = inject(ApiService);
      // ADR-0045: capture `?ref=` before anything can navigate away or fail. Synchronous,
      // localStorage-only, and outside the try because it cannot throw — but ahead of it anyway,
      // so a config/auth hiccup can never cost us the attribution. The analytics for it have to
      // wait for `analytics.init()` below, which needs the key from config.json; the storage write
      // cannot, because the visitor can click the hero CTA and navigate away first.
      const referralCaptured = referral.capture();
      // ADR-0048: queue `?utm_*` in the same breath and for the same reason — storage-only and
      // synchronous, so a visitor who clicks the hero CTA before config.json lands still counts.
      attribution.capture();
      try {
        await config.load();
        // ADR-0037: start analytics as soon as the key is known — before auth, so `app_launched` and
        // the first `$pageview` land even if the session bootstrap is slow or fails. Non-blocking
        // (the SDK is imported lazily) and inert when no project key is configured.
        analytics.init();
        // ADR-0045: before the first event, so `app_launched` and everything after it carry the
        // creator. Reads from storage rather than from `referralCaptured`, so a returning visitor
        // — captured on a previous visit, or on the static landing page — is attributed too.
        analytics.attachReferral(referral.slug);
        analytics.capture('app_launched');
        // Only when THIS visit created it: "holds a referral" is true forever, "was referred just
        // now" is the countable event.
        if (referralCaptured) analytics.capture('referral_captured');
        await auth.init();
        // ADR-0048: drain AFTER auth, because the endpoint needs a session — including the silent
        // anonymous one, since most campaign traffic never signs up and that is exactly the
        // population a conversion rate is measured against. Deliberately NOT awaited: reporting a
        // campaign must never delay first paint, and it must never be able to fail startup.
        void drainAttribution(api, attribution);
      } catch (err) {
        console.error('[startup] config/auth init failed; continuing degraded', err);
      }
    }),
  ],
};

/**
 * Post every queued campaign arrival, then drop the ones that landed.
 *
 * Sequential, not `Promise.all`: the queue is at most ten entries and almost always one, and a
 * burst of parallel writes against the same visitor row would contend on the server's unique index
 * for no gain. Stops at the first failure and leaves the rest queued — `clearSent` drops only the
 * prefix that succeeded, so a touch captured while this was in flight survives.
 */
async function drainAttribution(api: ApiService, attribution: AttributionService): Promise<void> {
  const pending = attribution.pending;
  if (!pending.length) return;
  const sent: typeof pending = [];
  for (const touch of pending) {
    if (!(await api.recordAttributionTouch(touch))) break;
    sent.push(touch);
  }
  attribution.clearSent(sent);
}
