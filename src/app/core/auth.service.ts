import { Injectable, computed, inject, signal } from '@angular/core';
import { type Session, type SupabaseClient, createClient } from '@supabase/supabase-js';

import { ConfigService } from './config';

export type OAuthProvider = 'apple' | 'google';

/**
 * Supabase auth for the freemium funnel (F-002, ADR-0019/0020). The access token (a Supabase JWT)
 * is attached as a Bearer on every API call; road-travel-core verifies it (ADR-0010).
 *
 * Funnel:
 *  - On load we silently create an **anonymous** session (no signup) so the authenticated API works
 *    immediately — the person can try the app with zero friction.
 *  - Passwordless sign-in is **offered, not forced**: Apple, Google, passkey, or email magic-link.
 *  - When the current session is anonymous, signing in **links** the identity to the SAME user, so
 *    trips / usage / entitlements carry over (anonymous→account upgrade preserves `user_id`).
 *
 * When Supabase isn't configured (local dev), `configured` is false and the app runs
 * unauthenticated — the backend's local-dev path accepts that.
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
  /** True while the session is a silent anonymous session (Supabase sets `is_anonymous`). */
  readonly isAnonymous = computed(() => !!this._session()?.user?.is_anonymous);
  /** Signed in with a real (non-anonymous) identity — the only state allowed to subscribe. */
  readonly hasRealAccount = computed(() => this.isAuthenticated() && !this.isAnonymous());

  /** Called once after config loads (app initializer). Bootstraps an anonymous session. */
  async init(): Promise<void> {
    const { supabaseUrl, supabaseAnonKey } = this.config.value;
    if (!supabaseUrl || !supabaseAnonKey) {
      this.configured.set(false);
      return;
    }
    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
    this.configured.set(true);
    this.supabase.auth.onAuthStateChange((_event, session) => this._session.set(session));

    const { data } = await this.supabase.auth.getSession();
    this._session.set(data.session);
    if (!data.session) await this.bootstrapAnonymous();
  }

  /** Silent anonymous sign-in so the API works without the person signing up (ADR-0019). */
  private async bootstrapAnonymous(): Promise<void> {
    if (!this.supabase) return;
    const { data, error } = await this.supabase.auth.signInAnonymously();
    if (!error) this._session.set(data.session);
  }

  // --- Sign-in / upgrade (offered, not forced; required only to subscribe) ------------------------

  /**
   * Continue with Apple/Google. If the current session is anonymous this **links** the provider to
   * the same user (upgrade, preserving `user_id`); otherwise it's a fresh OAuth sign-in. Redirects
   * away and back, so it resolves on return.
   */
  async continueWithOAuth(provider: OAuthProvider): Promise<{ error?: string }> {
    if (!this.supabase) return { error: 'Sign-in is not configured for this environment.' };
    const options = { redirectTo: `${window.location.origin}/app` };
    if (this.isAnonymous()) {
      // Prefer upgrading the anonymous session in place (keeps trips/usage on the SAME user_id).
      // On success this REDIRECTS away, so we only reach past it on an immediate error — e.g.
      // "Manual linking is disabled" on the project, or the identity already exists. Fall back to a
      // fresh OAuth sign-in (the anonymous session's local data won't carry over — expected here).
      const { error } = await this.supabase.auth.linkIdentity({ provider, options });
      if (!error) return {};
    }
    const { error } = await this.supabase.auth.signInWithOAuth({ provider, options });
    return error ? { error: error.message } : {};
  }

  /**
   * Continue with an email magic-link / upgrade an anonymous session to this email. For an anonymous
   * user we call `updateUser({ email })`, which emails a confirmation that permanently attaches the
   * address to the SAME user (upgrade); for a signed-out state it's a normal magic-link.
   */
  async continueWithEmail(email: string): Promise<{ error?: string }> {
    if (!this.supabase) return { error: 'Sign-in is not configured for this environment.' };
    const redirect = { emailRedirectTo: `${window.location.origin}/app` };
    if (this.isAnonymous()) {
      // Try to upgrade the anonymous session in place (keeps trips/usage on the SAME user_id).
      const { error } = await this.supabase.auth.updateUser({ email }, redirect);
      if (!error) return {};
      // Upgrade-in-place failed — the email already has an account (Supabase can't merge two
      // users), OR manual linking is disabled on the project. Either way, fall through to a normal
      // magic-link SIGN-IN. (The throwaway anonymous session's local data won't carry over — that's
      // expected when signing into / creating the durable account.)
    }
    // Signed-out, or an anonymous upgrade that couldn't be done in place → magic-link sign-in.
    const { error } = await this.supabase.auth.signInWithOtp({ email, options: redirect });
    return error ? { error: error.message } : {};
  }

  /** Whether the Supabase JS build exposes WebAuthn/passkey sign-in (still rolling out). */
  get passkeySupported(): boolean {
    const auth = this.supabase?.auth as unknown as { signInWithWebAuthn?: unknown } | undefined;
    return typeof auth?.signInWithWebAuthn === 'function' && !!window.PublicKeyCredential;
  }

  /** Passwordless passkey (WebAuthn/FIDO2) sign-in, when the SDK supports it (ADR-0020). */
  async continueWithPasskey(): Promise<{ error?: string }> {
    if (!this.supabase) return { error: 'Sign-in is not configured for this environment.' };
    const auth = this.supabase.auth as unknown as {
      signInWithWebAuthn?: (args: { action: 'authenticate' | 'register' }) => Promise<{
        error: { message: string } | null;
      }>;
    };
    if (typeof auth.signInWithWebAuthn !== 'function') {
      return { error: 'Passkeys are not available in this build — use Apple, Google, or email.' };
    }
    const action = this.isAnonymous() ? 'register' : 'authenticate';
    const { error } = await auth.signInWithWebAuthn({ action });
    return error ? { error: error.message } : {};
  }

  async signOut(): Promise<void> {
    await this.supabase?.auth.signOut();
    this._session.set(null);
    // Drop back to a fresh anonymous session so the app keeps working post-sign-out.
    if (this.supabase) await this.bootstrapAnonymous();
  }

  get token(): string | null {
    return this._session()?.access_token ?? null;
  }

  get userId(): string | null {
    return this._session()?.user?.id ?? null;
  }
}
