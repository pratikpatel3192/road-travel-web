import { Routes } from '@angular/router';

import { authGuard, realAccountGuard } from './core/auth.guard';
import { Home } from './pages/home/home';
import { Privacy } from './pages/privacy/privacy';
import { Support } from './pages/support/support';

export const routes: Routes = [
  // Design-6a marketing hero (NOT the old coming-soon teaser): wordmark + tagline + Get the app /
  // Open web app. The planner stays the product surface at /app (guests may browse, ADR-0025 §1).
  { path: '', component: Home },
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
