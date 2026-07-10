import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { ApiService } from './api.service';
import { AuthService } from './auth.service';

/**
 * The signed-in identity as the header shows it: the profile's display/first name when the user has
 * set one (onboarding/Settings, F-003), falling back to the account email. Loaded when a real
 * account appears and re-pulled after profile edits via `refresh()`.
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  private readonly _name = signal<string | null>(null);

  /** What the header identity chip renders — never empty while signed in (email is the floor). */
  readonly headerName = computed(() => this._name() || this.auth.email());

  constructor() {
    effect(() => {
      if (this.auth.hasRealAccount()) void this.refresh();
      else this._name.set(null);
    });
  }

  /** Re-pull the profile name (call after onboarding or Settings profile saves). */
  async refresh(): Promise<void> {
    try {
      const p = await this.api.getProfile();
      this._name.set(p.display_name || p.first_name || null);
    } catch {
      this._name.set(null); // profile unavailable -> the chip falls back to the email
    }
  }
}
