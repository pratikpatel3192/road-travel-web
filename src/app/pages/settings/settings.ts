import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SettingsService, type ThemeMode } from '../../core/settings.service';
import { PlaceField } from '../plan/place-field';
import { ProfileSettings } from './profile-settings';

/** The Settings screen — profile, appearance, units, and Home/Work favorites (iOS parity). */
@Component({
  selector: 'app-settings',
  imports: [RouterLink, PlaceField, ProfileSettings],
  template: `
    <div class="page">
      <header class="top">
        <a routerLink="/app" class="back" aria-label="Back">←</a>
        <h1>Settings</h1>
      </header>

      <app-profile-settings />

      <section class="card">
        <h2>Appearance</h2>
        <div class="seg" role="group" aria-label="Appearance">
          @for (t of themes; track t.value) {
            <button
              type="button"
              [class.on]="settings.theme() === t.value"
              (click)="settings.setTheme(t.value)"
            >
              {{ t.label }}
            </button>
          }
        </div>
      </section>

      <section class="card">
        <h2>Units</h2>
        <div class="seg" role="group" aria-label="Units">
          <button type="button" [class.on]="settings.units() === 'imperial'" (click)="settings.setUnits('imperial')">
            Miles · °F
          </button>
          <button type="button" [class.on]="settings.units() === 'metric'" (click)="settings.setUnits('metric')">
            Kilometers · °C
          </button>
        </div>
      </section>

      <section class="card">
        <h2>Favorites</h2>
        <label class="fav-label">Home</label>
        <div class="fav-field">
          <app-place-field
            kind="origin"
            placeholder="Search a place"
            [place]="settings.home()"
            (placeChange)="settings.setHome($event)"
          />
        </div>
        <label class="fav-label">Work</label>
        <div class="fav-field">
          <app-place-field
            kind="destination"
            placeholder="Search a place"
            [place]="settings.work()"
            (placeChange)="settings.setWork($event)"
          />
        </div>
      </section>

      <section class="card links">
        <a routerLink="/privacy">Privacy Policy</a>
        <a routerLink="/support">Support</a>
      </section>
    </div>
  `,
  styles: [
    `
      .page {
        max-width: 560px;
        margin: 0 auto;
        padding: 18px 16px 64px;
      }
      .top {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
      }
      .back {
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        border: 1px solid var(--border);
        background: var(--surface);
        color: var(--text);
        font-size: 18px;
      }
      .back:hover {
        text-decoration: none;
      }
      h1 {
        font-size: 22px;
        margin: 0;
      }
      .card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 14px 16px;
        margin-bottom: 14px;
      }
      h2 {
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--muted);
        margin: 0 0 10px;
      }
      .seg {
        display: flex;
        gap: 6px;
        background: var(--surface-2);
        border-radius: 10px;
        padding: 4px;
      }
      .seg button {
        flex: 1;
        padding: 9px 8px;
        border: none;
        background: transparent;
        color: var(--text);
        font: inherit;
        font-size: 14px;
        border-radius: 8px;
        cursor: pointer;
      }
      .seg button.on {
        background: var(--accent);
        color: var(--accent-contrast);
        font-weight: 600;
      }
      .links {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .fav-label {
        display: block;
        font-size: 13px;
        color: var(--text);
        font-weight: 600;
        margin: 6px 0 2px;
      }
      .fav-field {
        border: 1px solid var(--border);
        border-radius: 10px;
        background: var(--surface-2);
      }
      .fav-field + .fav-label {
        margin-top: 12px;
      }
    `,
  ],
})
export class Settings {
  readonly settings = inject(SettingsService);
  readonly themes: { value: ThemeMode; label: string }[] = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];
}
