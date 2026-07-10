import { Routes } from '@angular/router';

import { authGuard, realAccountGuard } from './core/auth.guard';
import { Home } from './pages/home/home';
import { Privacy } from './pages/privacy/privacy';
import { Support } from './pages/support/support';

export const routes: Routes = [
  { path: '', component: Home },
  // The planner + auth are lazy so the marketing site stays light (the SDK + Mapbox load on demand).
  {
    path: 'app',
    loadComponent: () => import('./pages/plan/plan').then((m) => m.Plan),
    canActivate: [authGuard],
  },
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
  { path: 'privacy', component: Privacy },
  { path: 'support', component: Support },
  { path: '**', redirectTo: '' },
];
