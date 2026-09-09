import { Injectable } from '@angular/core';

/**
 * ADR-0045: the creator slug that sent this visitor, captured from `?ref=` and carried to signup.
 *
 * Two entry points capture it, because of ADR-0038: the static `public/landing.html` at `/` (a few
 * lines of inline JS, since that page is served by nginx outside Angular) and this service on app
 * bootstrap, for people landing on `/plan?ref=…` directly. Both write the SAME `rt_ref` key under
 * the same only-if-absent rule, so whichever the visitor meets first wins and the other is inert.
 *
 * `localStorage`, not `sessionStorage`: the gap between clicking a creator link and actually signing
 * up is frequently days, and Supabase magic-link auth bounces the user out to their email client and
 * back. A session-scoped value would not survive either.
 *
 * This is only capture and carry. The server decides attribution — it records the slug against the
 * account on the first signed-in `GET /v1/me` and ignores every later one (first touch wins), so
 * this client never needs to know whether it has already been counted.
 */
@Injectable({ providedIn: 'root' })
export class ReferralService {
  private static readonly KEY = 'rt_ref';
  /** Mirrors `normalize_referrer` and the `users_referred_by_format_check` constraint. */
  private static readonly SLUG = /^[a-z0-9][a-z0-9-]{0,31}$/;

  /**
   * Record `?ref=` if there is one and nothing is stored yet. Called once from the app
   * initializer. Returns whether THIS call recorded a new referral.
   *
   * Only-if-absent is what makes this first-touch on the client too, matching the server: a
   * visitor who returns under a different creator's link keeps the original attribution rather
   * than overwriting it and then having the server reject the change anyway.
   *
   * The return value is what the `referral_captured` analytics event hangs off — the same shape as
   * the server's `set_referrer_if_absent`, and for the same reason. "This browser holds a
   * referral" is true on every launch forever; "this visit is the one that created it" is true
   * exactly once, and only the second is an event worth counting.
   *
   * Storage only, deliberately: no analytics dependency, because this has to run before
   * `ConfigService.load()` (a visitor can click the hero CTA and navigate away before a network
   * round-trip finishes) while analytics cannot start until the key arrives. The caller emits.
   */
  capture(search: string = window.location.search): boolean {
    const ref = new URLSearchParams(search).get('ref');
    if (!ref || !ReferralService.SLUG.test(ref)) return false;
    try {
      if (localStorage.getItem(ReferralService.KEY) !== null) return false;
      localStorage.setItem(ReferralService.KEY, ref);
      return true;
    } catch {
      // localStorage unavailable (private mode / blocked). The referral is simply not captured —
      // never worth breaking startup for.
      return false;
    }
  }

  /** The stored slug, or null. Re-validated on read: the value is hand-editable in devtools, and
   * there is no reason to spend a header on something the server will only discard. */
  get slug(): string | null {
    try {
      const value = localStorage.getItem(ReferralService.KEY);
      return value && ReferralService.SLUG.test(value) ? value : null;
    } catch {
      return null;
    }
  }
}
