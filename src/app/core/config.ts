import { Injectable, signal } from '@angular/core';

/**
 * Per-env runtime configuration (ADR-0014: dev/uat/prod each get their own values). Loaded from
 * `/config.json` at startup (see `provideAppInitializer` in app.config.ts) so one build serves every
 * environment — the deploy drops the right config.json. Everything degrades gracefully when a value
 * is absent (no Supabase → auth disabled; no Mapbox token → SVG route fallback).
 */
export interface AppConfig {
  /** Base URL of road-travel-core, e.g. https://road-travel-core-dev.run.app */
  apiBaseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Public Mapbox token (pk.…, URL-restricted) — only for rendering the map (ADR-0012). */
  mapboxToken: string;
  /** RevenueCat Web Billing public API key (F-002). Absent → billing disabled, paywall read-only. */
  revenueCatWebApiKey: string;
  /** RevenueCat offering id whose packages back the paywall plans (optional; SDK default if blank). */
  revenueCatOfferingId: string;
}

const DEFAULTS: AppConfig = {
  apiBaseUrl: '',
  supabaseUrl: '',
  supabaseAnonKey: '',
  mapboxToken: '',
  revenueCatWebApiKey: '',
  revenueCatOfferingId: '',
};

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly _config = signal<AppConfig>(DEFAULTS);
  readonly config = this._config.asReadonly();

  get value(): AppConfig {
    return this._config();
  }

  /** Fetch `/config.json`; on any failure keep defaults so the app still boots. */
  async load(): Promise<void> {
    try {
      const res = await fetch('config.json', { cache: 'no-store' });
      if (res.ok) {
        this._config.set({ ...DEFAULTS, ...((await res.json()) as Partial<AppConfig>) });
      }
    } catch {
      /* keep defaults — degraded but functional */
    }
  }
}
