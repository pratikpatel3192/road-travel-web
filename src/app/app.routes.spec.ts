import { routes } from './app.routes';
import { authGuard } from './core/auth.guard';
import { NotFound } from './pages/not-found/not-found';

/**
 * ADR-0038 REVERSES T-021. The root is no longer an Angular route at all — it is a static marketing
 * page served by nginx from `public/landing.html` — the planner lives at `/plan` behind the same
 * guard, and the catch-all is a real NotFound instead of a redirect to the planner.
 *
 * These assert the route *config* shape rather than resolving the lazy component — invoking
 * `loadComponent` would pull `Plan` (and Leaflet) into jsdom. The build + the static import
 * string guarantee it resolves to `Plan`.
 */
describe('ADR-0038 routing: landing page at /, planner at /plan', () => {
  const byPath = (p: string) => routes.find((r) => r.path === p);

  it('serves the lazily-loaded planner at /plan, behind authGuard', () => {
    const plan = byPath('plan');
    expect(plan).toBeTruthy();
    // Lazy Plan load, not a static component.
    expect(plan!.loadComponent).toBeTypeOf('function');
    expect(plan!.component).toBeUndefined();
    // Same guard that gated the root — guests (anonymous) pass, ADR-0025 §1.
    expect(plan!.canActivate).toContain(authGuard);
  });

  it('claims no Angular route at the root — nginx serves landing.html there', () => {
    expect(byPath('')).toBeUndefined();
  });

  it('redirects legacy /app to /plan (OAuth, magic links, Stripe and the PWA all land there)', () => {
    const app = byPath('app');
    expect(app).toBeTruthy();
    expect(app!.redirectTo).toBe('plan');
    expect(app!.pathMatch).toBe('full');
    // The redirect must not also carry a component/guard.
    expect(app!.loadComponent).toBeUndefined();
    expect(app!.canActivate).toBeUndefined();
  });

  it('declares /auth-callback explicitly instead of leaning on the catch-all', () => {
    const callback = byPath('auth-callback');
    expect(callback).toBeTruthy();
    expect(callback!.redirectTo).toBe('plan');
    expect(callback!.pathMatch).toBe('full');
  });

  it('answers an unknown path with a NotFound component, never a redirect to app content', () => {
    const wildcard = byPath('**');
    expect(wildcard).toBeTruthy();
    expect(wildcard!.component).toBe(NotFound);
    // A `redirectTo` here is the soft-404 farm ADR-0038 removed — it must not come back.
    expect(wildcard!.redirectTo).toBeUndefined();
  });

  it('keeps the wildcard last, so it cannot shadow a real route', () => {
    expect(routes.at(-1)!.path).toBe('**');
    expect(routes.filter((r) => r.path === '**')).toHaveLength(1);
  });

  it('keeps every path the nginx allowlist promises to serve', () => {
    // docker/nginx.conf.template only falls back to the app shell for these prefixes; a route added
    // here without an allowlist entry would 404 before Angular ever loaded.
    const allowlisted = [
      'plan',
      'app',
      'auth-callback',
      'checkout-return',
      'login',
      'settings',
      'saved',
      'driving',
      'chats',
      'friends',
      'privacy',
      'terms',
      'support',
      'unsubscribe',
    ];
    for (const route of routes) {
      if (route.path === '**') continue;
      const firstSegment = route.path!.split('/')[0];
      expect(allowlisted).toContain(firstSegment);
    }
  });
});
