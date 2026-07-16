import { routes } from './app.routes';
import { authGuard } from './core/auth.guard';

/**
 * T-021: the root path IS the product (the trip planner), the marketing `Home` page is removed, and
 * old `/app` bookmarks redirect to the root. These assert the route *config* shape rather than
 * resolving the lazy component — invoking `loadComponent` would pull `Plan` (and `mapbox-gl`) into
 * jsdom. The build + the static import string guarantee it resolves to `Plan`.
 */
describe('T-021 root routing', () => {
  const byPath = (p: string) => routes.find((r) => r.path === p);

  it('lands on the lazily-loaded planner at the root, behind authGuard', () => {
    const root = byPath('');
    expect(root).toBeTruthy();
    // Lazy Plan load, not a static component (the marketing Home component is gone).
    expect(root!.loadComponent).toBeTypeOf('function');
    expect(root!.component).toBeUndefined();
    // Same guard that previously gated /app — guests (anonymous) pass, ADR-0025 §1.
    expect(root!.canActivate).toContain(authGuard);
  });

  it('redirects legacy /app to the root so old bookmarks still resolve', () => {
    const app = byPath('app');
    expect(app).toBeTruthy();
    expect(app!.redirectTo).toBe('');
    expect(app!.pathMatch).toBe('full');
    // The redirect must not also carry a component/guard.
    expect(app!.loadComponent).toBeUndefined();
    expect(app!.canActivate).toBeUndefined();
  });

  it('no longer references the removed marketing Home component anywhere in the route table', () => {
    // Home was deleted; no route should bind a static `component` at the root.
    expect(byPath('')!.component).toBeUndefined();
  });
});
