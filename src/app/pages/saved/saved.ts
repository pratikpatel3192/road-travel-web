import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { SavedTripModel } from '@road-travel/sdk';

import { SettingsService } from '../../core/settings.service';
import { TripsService } from '../../core/trips.service';
import { SEVERITY_COLOR, formatDistance, severityOrFallback } from '../plan/severity';
import { savedTripSubtext } from './trip-subtext';

/**
 * "My trips" — the server-authoritative list (ADR-0029; no recents). Tap one to reopen.
 *
 * It is the whole history now, not a shortlist somebody curated: planning a trip saves it, so the
 * list a traveller sees here is the same one their phone sees. It used to sit above a device-local
 * "Recent" section that never left this browser, which is how a trip planned on the laptop could be
 * missing from the phone while both screens looked like a synced list.
 */
@Component({
  selector: 'app-saved',
  imports: [RouterLink],
  template: `
    <div class="page">
      <header class="top">
        <a routerLink="/plan" class="back" aria-label="Back">←</a>
        <h1>My trips</h1>
      </header>

      @if (trips.saved().length) {
        @for (t of trips.saved(); track t.id) {
          <div class="row">
            <button class="open" (click)="open(t)">
              <span class="badge" [style.background]="color(t.worst_severity)"></span>
              <!-- One row is the whole trip, origin to destination; the line under it is what the
                   trip turned out to be, so a parks tour is legible without opening it. -->
              <span class="names">
                <span class="endpoints"
                  >{{ short(t.origin_name) }} → {{ short(t.destination_name) }}</span
                >
                @if (subtext(t)) {
                  <span class="sub">{{ subtext(t) }}</span>
                }
              </span>
              @if (t.distance_meters) {
                <span class="sub">{{ dist(t.distance_meters) }}</span>
              }
            </button>
            <a
              class="plan-days"
              [routerLink]="['/saved', t.id]"
              title="Plan this trip day by day"
              aria-label="Plan this trip day by day"
              >Days</a
            >
            <button class="del" (click)="remove(t.id)" aria-label="Delete saved trip">✕</button>
          </div>
        }
      } @else if (trips.loading()) {
        <p class="empty">Loading your trips…</p>
      } @else {
        <p class="empty">No trips yet. Plan a drive and it'll show up here, on every device.</p>
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
      /* Endpoints on top, what the trip is underneath — stacked rather than strung along one line,
         because the subtext is about the trip and the distance beside it is a measurement. */
      .names {
        flex: 1;
        display: grid;
        gap: 2px;
        min-width: 0;
      }
      .endpoints {
        font-weight: 600;
        font-size: 15px;
      }
      .sub {
        color: var(--muted);
        font-size: 13px;
      }
      /* The way into the itinerary. On the saved row rather than a screen of its own because a
         month-long trip IS a saved trip — this is the same object, looked at by day. */
      .plan-days {
        padding: 5px 10px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: var(--surface);
        color: var(--text-secondary);
        font-size: 12px;
        font-weight: 700;
      }
      .plan-days:hover {
        text-decoration: none;
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

  /**
   * Re-open a saved trip: stage its endpoints (server-provided coordinates) — stops + dwell
   * included (F-006 US-4) — and re-plan.
   */
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
      waypoints: t.waypoints,
      // F-012: carries the server baseline through, so re-briefing this trip on ANY device leads
      // with what changed since it was last briefed.
      savedTripId: t.id,
    });
    this.router.navigate(['/plan']);
  }

  /** Deleting is still deliberate: planning saves a trip, only this removes one. */
  remove(id: string): void {
    void this.trips.remove(id);
  }

  /** "5 stops · 15 days"; a plain A → B drive says just "1 day" rather than counting no stops. */
  subtext(t: SavedTripModel): string {
    return savedTripSubtext(t);
  }

  short(name: string): string {
    return name.split(',')[0];
  }
  dist(m: number): string {
    return formatDistance(m, this.settings.units());
  }
  /**
   * The worst-stretch badge on a saved trip. An absent value stays the neutral border — the row
   * was saved without a worst stretch and we will not invent one. A PRESENT but unrecognised value
   * degrades to caution: the `as Severity` cast used to hand it straight to the lookup, which
   * returned undefined and drew no badge at all, hiding the one row that most deserved one.
   */
  color(s?: string | null): string {
    return s ? SEVERITY_COLOR[severityOrFallback(s)] : 'var(--border)';
  }
}
