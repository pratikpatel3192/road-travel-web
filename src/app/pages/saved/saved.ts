import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { SavedTripModel } from '@road-travel/sdk';

import { SettingsService } from '../../core/settings.service';
import { type RecentTrip, TripsService } from '../../core/trips.service';
import { SEVERITY_COLOR, type Severity, formatDistance } from '../plan/severity';

/** "My trips" — the server-authoritative saved list (ADR-0029; no recents). Tap one to reopen. */
@Component({
  selector: 'app-saved',
  imports: [RouterLink],
  template: `
    <div class="page">
      <header class="top">
        <a routerLink="/app" class="back" aria-label="Back">←</a>
        <h1>My trips</h1>
      </header>

      @if (trips.recent().length) {
        <h2>Recent</h2>
        @for (t of trips.recent(); track key(t)) {
          <div class="row">
            <button class="open" (click)="openRecent(t)">
              <span class="badge" [style.background]="color(t.worstSeverity)"></span>
              <span class="names">{{ short(t.origin.name) }} → {{ short(t.destination.name) }}</span>
              @if (t.distanceMeters) {
                <span class="sub">{{ dist(t.distanceMeters) }}</span>
              }
            </button>
            <button class="del" (click)="removeRecent(t)" aria-label="Remove recent trip">✕</button>
          </div>
        }
      }

      <h2>Saved</h2>
      @if (trips.saved().length) {
        @for (t of trips.saved(); track t.id) {
          <div class="row">
            <button class="open" (click)="open(t)">
              <span class="badge" [style.background]="color(t.worst_severity)"></span>
              <span class="names">{{ short(t.origin_name) }} → {{ short(t.destination_name) }}</span>
              @if (t.distance_meters) {
                <span class="sub">{{ dist(t.distance_meters) }}</span>
              }
            </button>
            <button class="del" (click)="remove(t.id)" aria-label="Delete saved trip">✕</button>
          </div>
        }
      } @else if (trips.loading()) {
        <p class="empty">Loading your trips…</p>
      } @else {
        <p class="empty">No saved trips yet. Plan a drive and tap the star to save it.</p>
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

  constructor() {
    // Fresh server state whenever the page opens (deletes from other devices show up).
    void this.trips.refresh();
  }

  /** Re-open a saved trip: stage its endpoints (server-provided coordinates) and re-plan. */
  open(t: SavedTripModel): void {
    if (t.origin_latitude == null || t.destination_latitude == null) return;
    this.trips.stage({
      origin: {
        name: t.origin_name,
        latitude: t.origin_latitude,
        longitude: t.origin_longitude ?? 0,
      },
      destination: {
        name: t.destination_name,
        latitude: t.destination_latitude,
        longitude: t.destination_longitude ?? 0,
      },
      departureAt: t.departure_at,
    });
    this.router.navigate(['/app']);
  }

  remove(id: string): void {
    void this.trips.remove(id);
  }

  /** Recent trips (local): re-open by staging the stored endpoints + re-planning. */
  key(t: RecentTrip): string {
    return `${t.origin.name}→${t.destination.name}`;
  }
  openRecent(t: RecentTrip): void {
    this.trips.stage({ origin: t.origin, destination: t.destination, departureAt: t.departureAt });
    this.router.navigate(['/app']);
  }
  removeRecent(t: RecentTrip): void {
    this.trips.removeRecent(this.key(t));
  }

  short(name: string): string {
    return name.split(',')[0];
  }
  dist(m: number): string {
    return formatDistance(m, this.settings.units());
  }
  color(s?: string | null): string {
    return s ? SEVERITY_COLOR[s as Severity] : 'var(--border)';
  }
}
