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
      try {
        await config.load();
        // ADR-0037: start analytics as soon as the key is known — before auth, so `app_launched` and
        // the first `$pageview` land even if the session bootstrap is slow or fails. Non-blocking
        // (the SDK is imported lazily) and inert when no project key is configured.
        analytics.init();
        analytics.capture('app_launched');
        await auth.init();
      } catch (err) {
        console.error('[startup] config/auth init failed; continuing degraded', err);
      }
    }),
  ],
};
