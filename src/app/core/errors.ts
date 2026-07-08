import type { PaywallResponse } from '@road-travel/sdk';

/**
 * Thrown by ApiService when the backend returns a 402 free-tier cap (F-002). Carries the server's
 * paywall payload so the UI renders it verbatim — the client never decides pricing or entitlement.
 */
export class PaywallError extends Error {
  constructor(readonly payload: PaywallResponse) {
    super(payload.message ?? 'Upgrade required');
    this.name = 'PaywallError';
  }
}

/** A generic API failure with the HTTP status, for the plan page's error copy. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
