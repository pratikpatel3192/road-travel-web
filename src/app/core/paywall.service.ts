import { Injectable, signal } from '@angular/core';
import type { PaywallResponse } from '@road-travel/sdk';

/**
 * Holds the currently-visible paywall payload (F-002). ApiService raises a PaywallError on a 402; a
 * caller (the plan page) hands the payload here, and the PaywallComponent (mounted app-wide) renders
 * it. Server-authoritative: the payload — reason, plans, trial length — comes straight from core.
 */
@Injectable({ providedIn: 'root' })
export class PaywallService {
  private readonly _payload = signal<PaywallResponse | null>(null);
  readonly payload = this._payload.asReadonly();

  show(payload: PaywallResponse): void {
    this._payload.set(payload);
  }

  dismiss(): void {
    this._payload.set(null);
  }
}
