import { Injectable, computed, inject, signal } from '@angular/core';
import { type Session, type SupabaseClient, createClient } from '@supabase/supabase-js';

import { ConfigService } from './config';

/**
 * Supabase auth (magic-link). The access token (a Supabase JWT) is attached as a Bearer on every
 * API call (see ApiService); road-travel-core verifies it (JWKS, exp/iss/aud, pinned alg — ADR-0010).
 * When Supabase isn't configured, `configured` is false and the app runs unauthenticated — the
 * backend's local-dev path accepts that, which keeps local development frictionless.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly config = inject(ConfigService);
  private supabase: SupabaseClient | null = null;

  private readonly _session = signal<Session | null>(null);
  readonly session = this._session.asReadonly();
  readonly configured = signal(false);
  readonly isAuthenticated = computed(() => !!this._session());
  readonly email = computed(() => this._session()?.user?.email ?? null);

  /** Called once after config loads (app initializer). */
  init(): void {
    const { supabaseUrl, supabaseAnonKey } = this.config.value;
    if (!supabaseUrl || !supabaseAnonKey) {
      this.configured.set(false);
      return;
    }
    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
    this.configured.set(true);
    void this.supabase.auth.getSession().then(({ data }) => this._session.set(data.session));
    this.supabase.auth.onAuthStateChange((_event, session) => this._session.set(session));
  }

  async signInWithEmail(email: string): Promise<{ error?: string }> {
    if (!this.supabase) return { error: 'Sign-in is not configured for this environment.' };
    const { error } = await this.supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/app` },
    });
    return error ? { error: error.message } : {};
  }

  async signOut(): Promise<void> {
    await this.supabase?.auth.signOut();
    this._session.set(null);
  }

  get token(): string | null {
    return this._session()?.access_token ?? null;
  }
}
