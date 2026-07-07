import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { SettingsService } from '../../core/settings.service';
import { TripsService } from '../../core/trips.service';
import type { PlaceValue } from '../plan/place-field';
import { SEVERITY_COLOR, type Severity, formatDistance } from '../plan/severity';

/** "My trips" — saved and recent trips, mirroring the iOS SavedTripsView. Tap one to reopen it. */
@Component({
  selector: 'app-saved',
  imports: [RouterLink],
  template: `
    <div class="page">
      <header class="top">
        <a routerLink="/app" class="back" aria-label="Back">←</a>
        <h1>My trips</h1>
      </header>

      <h2>Saved</h2>
      @if (trips.saved().length) {
        @for (t of trips.saved(); track t.id) {
          <div class="row">
            <button class="open" (click)="open(t.origin, t.destination, t.departureAt)">
              <span class="badge" [style.background]="color(t.worstSeverity)"></span>
              <span class="names">{{ short(t.origin.name) }} → {{ short(t.destination.name) }}</span>
              @if (t.distanceMeters) {
                <span class="sub">{{ dist(t.distanceMeters) }}</span>
              }
            </button>
            <button class="del" (click)="trips.remove(t.id)" aria-label="Delete saved trip">✕</button>
          </div>
        }
      } @else {
        <p class="empty">No saved trips yet. Plan a drive and tap the star to save it.</p>
      }

      <h2>Recent</h2>
      @if (trips.recents().length) {
        @for (r of trips.recents(); track r.at) {
          <div class="row">
            <button class="open" (click)="open(r.origin, r.destination)">
              <span class="names">{{ short(r.origin.name) }} → {{ short(r.destination.name) }}</span>
            </button>
            <button class="del" (click)="trips.removeRecent(r.at)" aria-label="Remove recent trip">✕</button>
          </div>
        }
      } @else {
        <p class="empty">No recent trips.</p>
      }
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
        margin-bottom: 12px;
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
      h2 {
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--muted);
        margin: 18px 0 8px;
      }
      .row {
        display: flex;
        align-items: stretch;
        gap: 8px;
        margin-bottom: 8px;
      }
      .open {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 14px;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface);
        color: var(--text);
        font: inherit;
        text-align: left;
        cursor: pointer;
      }
      .open:hover {
        border-color: var(--accent);
      }
      .badge {
        flex: 0 0 auto;
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }
      .names {
        flex: 1;
        font-weight: 600;
        font-size: 15px;
      }
      .sub {
        color: var(--muted);
        font-size: 13px;
      }
      .del {
        flex: 0 0 auto;
        width: 44px;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface);
        color: var(--muted);
        font-size: 15px;
        cursor: pointer;
      }
      .del:hover {
        color: var(--sev-severe);
        border-color: var(--sev-severe);
      }
      .empty {
        color: var(--muted);
        font-size: 14px;
        padding: 4px 2px 8px;
      }
    `,
  ],
})
export class Saved {
  readonly trips = inject(TripsService);
  private readonly settings = inject(SettingsService);
  private readonly router = inject(Router);

  open(origin: PlaceValue, destination: PlaceValue, departureAt?: string): void {
    this.trips.stage({ origin, destination, departureAt });
    this.router.navigate(['/app']);
  }

  short(name: string): string {
    return name.split(',')[0];
  }
  dist(m: number): string {
    return formatDistance(m, this.settings.units());
  }
  color(s?: Severity): string {
    return s ? SEVERITY_COLOR[s] : 'var(--border)';
  }
}
