import { Injectable } from '@angular/core';

/**
 * Best-effort durable per-device id for the store-trial eligibility check (ADR-0025). The web can't
 * attest a device, so this is a **random, high-entropy** id persisted in localStorage — random so it
 * can't be guessed to burn another user's trial eligibility (review M-2), and the server treats it as
 * **advisory**: the real anti-farming backstop is the store's one-trial-per-payment-identity. Sent as
 * the `X-Device-Id` header on `/v1/me` (drives `trial_eligible`) and on the trial claim.
 */
@Injectable({ providedIn: 'root' })
export class DeviceService {
  private static readonly KEY = 'rt_device_id';

  get id(): string {
    try {
      let id = localStorage.getItem(DeviceService.KEY);
      if (!id) {
        id = this.mint();
        localStorage.setItem(DeviceService.KEY, id);
      }
      return id;
    } catch {
      // localStorage unavailable (private mode / blocked) — a per-session id, no persistence.
      return this.mint();
    }
  }

  private mint(): string {
    const c = globalThis.crypto;
    if (c?.randomUUID) return `web_${c.randomUUID()}`;
    return `web_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
}
