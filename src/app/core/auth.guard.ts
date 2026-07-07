import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/**
 * Gate the /app route. When Supabase auth isn't configured (local dev), allow through — the backend's
 * local-dev path accepts unauthenticated requests, so developers aren't blocked. When it IS
 * configured, require a session and otherwise bounce to /login.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.configured() || auth.isAuthenticated()) return true;
  return router.createUrlTree(['/login']);
};
