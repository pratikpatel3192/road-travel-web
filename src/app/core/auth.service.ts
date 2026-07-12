import { Injectable, computed, inject, signal } from '@angular/core';
import { type Session, type SupabaseClient, createClient } from '@supabase/supabase-js';

import { ConfigService } from './config';

export type OAuthProvider = 'apple' | 'google';

/** localStorage key for the last-activity stamp behind the 7-day inactivity rule. */
const LAST_ACTIVE_KEY = 'rt.lastActiveAt';
/** ADR-0025 §6: a web session idle longer than this is dropped and the user signs in again. */
const INACTIVITY_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;
/** Re-stamping on every token read would thrash localStorage — once a minute is plenty. */
const STAMP_THROTTLE_MS = 60 * 1000;

/** Pure so the 7-day rule is directly testable: true when the stored session must be dropped. */
export function isInactivityExpired(lastActiveMs: number, nowMs: number): boolean {
  return lastActiveMs > 0 && nowMs - lastActiveMs > INACTIVITY_LIMIT_MS;
}

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

  /** Auth-callback error from the URL (OAuth/magic-link redirects) — shown app-wide once. */
  readonly authError = signal<string | null>(null);

  /** Surface Supabase auth-callback errors instead of silently dropping the URL fragment. */
  private captureCallbackError(): void {
    try {
      const hash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
      const query = new URLSearchParams(window.location.search || '');
      const code = hash.get('error_code') ?? query.get('error_code');
      const desc = hash.get('error_description') ?? query.get('error_description');
      if (!code && !desc) return;
      this.authError.set(
        code === 'email_exists'
          ? 'This email already has a Road Travel account. Sign in with an email link instead — ' +
            'you can connect Google to it later in Settings.'
          : (desc ?? 'Sign-in failed. Please try again.').replace(/\+/g, ' '),
      );
      // Drop the error params so a reload doesn't re-show it.
      history.replaceState(null, '', window.location.pathname);
    } catch {
      /* URL parsing is best-effort */
    }
  }

  /** Called once after config loads (app initializer). Bootstraps an anonymous session. */
  async init(): Promise<void> {
    this.captureCallbackError();
    const { supabaseUrl, supabaseAnonKey } = this.config.value;
    if (!supabaseUrl || !supabaseAnonKey) {
      this.configured.set(false);
      return;
    }
    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
    this.configured.set(true);
    this.supabase.auth.onAuthStateChange((_event, session) => this._session.set(session));

    // ADR-0025 §6: web sessions expire after 7 days of INACTIVITY. Enforced at load: if the last
    // activity stamp is older than the limit, purge the stored session before reading it, so the
    // user lands signed out (a fresh anonymous session bootstraps below for browsing).
    if (isInactivityExpired(this.lastActive(), Date.now())) {
      await this.supabase.auth.signOut();
    }
    this.stampActivity();

    const { data } = await this.supabase.auth.getSession();
    this._session.set(data.session);
    if (!data.session) await this.bootstrapAnonymous();
  }

  private lastActive(): number {
    try {
      return Number(localStorage.getItem(LAST_ACTIVE_KEY) ?? 0) || 0;
    } catch {
      return 0;
    }
  }

  private lastStampMs = 0;

  /** Record activity (throttled) — every authenticated API call keeps the 7-day window open. */
  private stampActivity(): void {
    const now = Date.now();
    if (now - this.lastStampMs < STAMP_THROTTLE_MS) return;
    this.lastStampMs = now;
    try {
      localStorage.setItem(LAST_ACTIVE_KEY, String(now));
    } catch {
      /* storage may be unavailable (private mode) — the rule just won't persist */
    }
  }

  /** Silent anonymous sign-in so the API works without the person signing up (ADR-0019). */
  private async bootstrapAnonymous(): Promise<void> {
    if (!this.supabase) return;
    const { data, error } = await this.supabase.auth.signInAnonymously();
    if (!error) this._session.set(data.session);
  }

  // --- Sign-in / upgrade (offered, not forced; required only to subscribe) ------------------------

  /**
   * Continue with Apple/Google — always a plain OAuth sign-in. Redirects away and back, so it
   * resolves on return.
   */
  async continueWithOAuth(provider: OAuthProvider): Promise<{ error?: string }> {
    if (!this.supabase) return { error: 'Sign-in is not configured for this environment.' };
    const options = {
      redirectTo: `${window.location.origin}/app`,
      // Always show the account chooser — silently reusing the last-authorized Google account
      // makes multi-account users sign in as the wrong identity with no way to switch.
      queryParams: { prompt: 'select_account' },
    };
    // Never linkIdentity here: linking tried to upgrade the anonymous session in place, but an
    // "Identity is already linked to another user" failure only surfaces AFTER the provider
    // round-trip — past the point where any fallback could run — so every RETURNING user
    // dead-ended on that error. Since ADR-0025 removed the anonymous free tier, the guest session
    // holds nothing worth preserving; replacing it with the real sign-in is correct.
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
    // Reading the token = an authenticated call is about to happen — that's "activity".
    this.stampActivity();
    return this._session()?.access_token ?? null;
  }

  get userId(): string | null {
    return this._session()?.user?.id ?? null;
  }
}
