import { Routes } from '@angular/router';

import { authGuard, realAccountGuard } from './core/auth.guard';
import { Privacy } from './pages/privacy/privacy';
import { Support } from './pages/support/support';

export const routes: Routes = [
  // The product is live — no coming-soon landing. Marketing/legal live on the apex domain
  // (ADR-0024); the app's front door is the planner itself (guests may browse, ADR-0025 §1).
  { path: '', redirectTo: 'app', pathMatch: 'full' },
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
