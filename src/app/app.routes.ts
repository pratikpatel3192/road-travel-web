import { Routes } from '@angular/router';

import { authGuard, realAccountGuard } from './core/auth.guard';
import { NotFound } from './pages/not-found/not-found';
import { Privacy } from './pages/privacy/privacy';
import { Support } from './pages/support/support';
import { Terms } from './pages/terms/terms';

export const routes: Routes = [
  // ADR-0038 REVERSES T-021 ("the root IS the product"). The root is now a static, fully-rendered
  // marketing landing page served by nginx from public/landing.html — it is NOT an Angular route and
  // deliberately has no entry here. The planner moved to /plan, keeping its guard: guests may browse
  // (authGuard passes an anonymous session, ADR-0025 §1); the wall is at the value action.
  {
    path: 'plan',
    loadComponent: () => import('./pages/plan/plan').then((m) => m.Plan),
    canActivate: [authGuard],
  },
  // Back-compat: the planner lived at /app before T-021 and at / after it. `/app` is still the live
  // return target for Supabase OAuth, magic links, Stripe Checkout success/cancel and the installed
  // PWA's start_url, so this redirect is load-bearing, not just a courtesy for old bookmarks.
  // Exact-match so it can't shadow any future /app/* route. (nginx must also allowlist `app` — see
  // docker/nginx.conf.template.)
  { path: 'app', redirectTo: 'plan', pathMatch: 'full' },
  // Magic-link / Universal-Link callback. AuthService.init() consumes the token during the app
  // initializer, BEFORE routing, and rewrites the URL; this route exists for the case it cannot
  // (the `#tokens` fragment variant, which Supabase reads without a URL rewrite). Until ADR-0038
  // this path resolved only by accident, via the '**' catch-all being deleted below.
  { path: 'auth-callback', redirectTo: 'plan', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./pages/login/login').then((m) => m.Login) },
  // ADR-0025 §1: saved trips + Settings are LOGIN-ONLY (real account; the anonymous session doesn't count).
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings').then((m) => m.Settings),
    canActivate: [realAccountGuard],
  },
  {
    path: 'saved',
    loadComponent: () => import('./pages/saved/saved').then((m) => m.Saved),
    canActivate: [realAccountGuard],
  },
  // F-007 P1: view-only drives/garage/stats (recording is iOS-only for 3.0.0).
  {
    path: 'driving',
    loadComponent: () => import('./pages/driving/driving').then((m) => m.Driving),
    canActivate: [realAccountGuard],
  },
  // F-007 P3 M8: chat (history via REST, delivery via Realtime — ADR-0034).
  {
    path: 'chats',
    loadComponent: () => import('./pages/driving/chats').then((m) => m.Chats),
    canActivate: [realAccountGuard],
  },
  // F-007 P2.1: friend-request invite emails land here (explicit confirm; never a GET action).
  {
    path: 'friends/respond',
    loadComponent: () => import('./pages/respond/respond').then((m) => m.Respond),
    canActivate: [realAccountGuard],
  },
  // The unsubscribe link in marketing email. PUBLIC on purpose — no guard of any kind: the
  // recipient may be signed out, may have deleted their account, or may never have had one, and a
  // login wall in front of "stop emailing me" is both hostile and non-compliant. The signed token
  // in the link is the authorization (core verifies it); the page only ever confirms an explicit
  // button press, never acts on load.
  {
    path: 'unsubscribe',
    loadComponent: () => import('./pages/unsubscribe/unsubscribe').then((m) => m.Unsubscribe),
  },
  { path: 'privacy', component: Privacy },
  { path: 'terms', component: Terms },
  { path: 'support', component: Support },
  // ADR-0038: a real NotFound, NOT `redirectTo: ''`. The old catch-all answered every mistyped URL
  // with HTTP 200 and app content — a soft-404 farm. nginx now 404s unknown paths outright, so this
  // only catches bad IN-APP navigations (and keeps them from throwing NG04002).
  { path: '**', component: NotFound },
];
