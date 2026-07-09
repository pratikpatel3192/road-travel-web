import { Injectable, computed, inject, signal } from '@angular/core';
import type { MeResponse } from '@road-travel/sdk';

import { ApiService } from './api.service';

/**
 * Client-side view of the server-authoritative funnel state (ADR-0025). Polls `GET /v1/me` and
 * exposes `signedIn` / `isPro` / `trial` / `trialEligible` / `onboarded` so the UI can gate. The
 * server is the source of truth — this never grants access; it only reflects `/v1/me` (after a
 * store trial/purchase the signed webhook flips it server-side and a `refresh()` picks it up).
 */
@Injectable({ providedIn: 'root' })
export class EntitlementService {
  private readonly api = inject(ApiService);

  private readonly _me = signal<MeResponse | null>(null);
  readonly me = this._me.asReadonly();
  /** Signed in with a real (non-anonymous) account (ADR-0025 auth wall). */
  readonly signedIn = computed(() => !!this._me()?.signed_in);
  /** Full access: an active subscription OR an active store trial. */
  readonly isPro = computed(() => !!this._me()?.is_pro);
  /** The store trial state `{ active, ends_at }`, or null until /v1/me loads. */
  readonly trial = computed(() => this._me()?.trial ?? null);
  /** Can still start a free trial (no prior grant on this account or device). */
  readonly trialEligible = computed(() => !!this._me()?.trial_eligible);
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
