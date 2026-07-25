import { Injectable, inject, signal } from '@angular/core';
import { getConfigV1ConfigGet } from '@road-travel/sdk';

import { APP_VERSION } from '../version';
import { ConfigService } from './config';

const FLAGS_CACHE_KEY = 'rt.featureFlags';

/**
 * ADR-0036 remote config: the force-upgrade verdict + feature kill switches, fetched once at
 * boot. FAIL OPEN by design — until a fetch succeeds the app runs normally (flags fall back to
 * the last successful fetch, then to enabled), so an unreachable config service can never brick
 * the app. On the web, "update" simply means reloading the page to pick up the current bundle.
 */
@Injectable({ providedIn: 'root' })
export class RemoteConfigService {
  private readonly config = inject(ConfigService);

  readonly updateRequired = signal(false);
  readonly latestVersion = signal<string | null>(null);
  private readonly features = signal<Record<string, boolean>>(this.cachedFlags());

  /** Absent flags read as ENABLED (fail open) — new flag names never need a server change. */
  isEnabled(flag: string): boolean {
    return this.features()[flag] ?? true;
  }

  async fetch(): Promise<void> {
    try {
      const { data } = await getConfigV1ConfigGet({
        baseUrl: this.config.value.apiBaseUrl,
        query: { platform: 'web', version: APP_VERSION },
      });
      if (!data) return; // fail open
      this.updateRequired.set(!!data.update.required);
      this.latestVersion.set(data.update.latest_version);
      const flags = data.features ?? {};
      this.features.set(flags);
      try {
        localStorage.setItem(FLAGS_CACHE_KEY, JSON.stringify(flags));
      } catch {
        /* storage may be unavailable */
      }
    } catch {
      /* offline / config service down => keep running */
    }
  }

  /** The web upgrade: reload to pick up the deployed bundle. */
  reload(): void {
    window.location.reload();
  }

  private cachedFlags(): Record<string, boolean> {
    try {
      return JSON.parse(localStorage.getItem(FLAGS_CACHE_KEY) ?? '{}') as Record<string, boolean>;
    } catch {
      return {};
    }
  }
}
