import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';

import { SettingsService } from './core/settings.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  // Instantiate settings at bootstrap so the saved appearance is applied app-wide (and kept in sync).
  protected readonly settings = inject(SettingsService);
}
