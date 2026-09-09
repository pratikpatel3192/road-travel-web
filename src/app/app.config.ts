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
      // ADR-0045: capture `?ref=` before anything can navigate away or fail. Synchronous,
      // localStorage-only, and outside the try because it cannot throw — but ahead of it anyway,
      // so a config/auth hiccup can never cost us the attribution. The analytics for it have to
      // wait for `analytics.init()` below, which needs the key from config.json; the storage write
      // cannot, because the visitor can click the hero CTA and navigate away first.
      const referralCaptured = referral.capture();
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
      } catch (err) {
        console.error('[startup] config/auth init failed; continuing degraded', err);
      }
    }),
  ],
};
