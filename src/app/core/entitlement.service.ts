import { Injectable, computed, inject, signal } from '@angular/core';
import type { MeResponse } from '@road-travel/sdk';

import { ApiService } from './api.service';

/**
 * Client-side view of the server-authoritative entitlement + usage state (F-002). Polls `GET /v1/me`
 * and exposes `isPro` / `usage` so the UI can gate. The server is the source of truth — this never
 * grants Pro; it only reflects what `/v1/me` reports (after a purchase the RevenueCat webhook flips
 * it server-side and a `refresh()` picks it up).
 */
@Injectable({ providedIn: 'root' })
export class EntitlementService {
  private readonly api = inject(ApiService);

  private readonly _me = signal<MeResponse | null>(null);
  readonly me = this._me.asReadonly();
  readonly isPro = computed(() => !!this._me()?.is_pro);
  readonly usage = computed(() => this._me()?.usage ?? null);
  /** Whether onboarding is complete (F-003). Null until /v1/me has loaded. */
  readonly onboarded = computed(() => this._me()?.onboarded ?? null);

  /** Fetch the latest snapshot. Swallows errors (gating simply stays at its last known state). */
  async refresh(): Promise<MeResponse | null> {
    try {
      const me = await this.api.getMe();
      this._me.set(me);
      return me;
    } catch {
      return this._me();
    }
  }
}
