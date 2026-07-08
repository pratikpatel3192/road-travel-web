import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';

import { SettingsService } from './core/settings.service';
import { Onboarding } from './pages/onboarding/onboarding';
import { Paywall } from './pages/plan/paywall';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, Paywall, Onboarding],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  // Instantiate settings at bootstrap so the saved appearance is applied app-wide (and kept in sync).
  protected readonly settings = inject(SettingsService);
}
