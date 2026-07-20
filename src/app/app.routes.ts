import { Routes } from '@angular/router';

import { authGuard, realAccountGuard } from './core/auth.guard';
import { Privacy } from './pages/privacy/privacy';
import { Support } from './pages/support/support';
import { Terms } from './pages/terms/terms';

export const routes: Routes = [
  // The root IS the product: the trip planner renders directly at / (T-021). The old marketing home
  // page is gone — land users straight in the planner. Guests may browse (authGuard passes an
  // anonymous session, ADR-0025 §1); the wall is at the value action, not the front door.
  {
    path: '',
    loadComponent: () => import('./pages/plan/plan').then((m) => m.Plan),
    canActivate: [authGuard],
  },
  // Back-compat: the planner used to live at /app. Keep old bookmarks/links resolving to the new
  // root instead of 404ing (T-021). Exact-match so it can't shadow any future /app/* route.
  { path: 'app', redirectTo: '', pathMatch: 'full' },
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
  // F-007 P2.1: friend-request invite emails land here (explicit confirm; never a GET action).
  {
    path: 'friends/respond',
    loadComponent: () => import('./pages/respond/respond').then((m) => m.Respond),
    canActivate: [realAccountGuard],
  },
  { path: 'privacy', component: Privacy },
  { path: 'terms', component: Terms },
  { path: 'support', component: Support },
  { path: '**', redirectTo: '' },
];
