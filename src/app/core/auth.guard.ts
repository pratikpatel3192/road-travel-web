import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/**
 * Gate the /app route. When Supabase auth isn't configured (local dev), allow through — the backend's
 * local-dev path accepts unauthenticated requests, so developers aren't blocked. When it IS
 * configured, require a session and otherwise bounce to /login. The silent ANONYMOUS session passes:
 * ADR-0025 §1 keeps browsing + trip entry open to everyone (the wall is at the value action).
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.configured() || auth.isAuthenticated()) return true;
  return router.createUrlTree(['/login']);
};

/**
 * Gate the login-only pages — ADR-0025 §1: "Recent trips, saved trips, and Settings are login-only."
 * A real (non-anonymous) account is required; the silent anonymous session does NOT count, so guests
 * are bounced to /login instead of seeing an account-shaped page with nothing behind it.
 */
export const realAccountGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.configured() || auth.hasRealAccount()) return true;
  return router.createUrlTree(['/login']);
};
