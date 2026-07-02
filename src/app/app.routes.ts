import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { Privacy } from './pages/privacy/privacy';
import { Support } from './pages/support/support';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'privacy', component: Privacy },
  { path: 'support', component: Support },
  { path: '**', redirectTo: '' }
];
