import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { DriveModel, MeStatsResponse, VehicleModel } from '@road-travel/sdk';

import { ApiService } from '../../core/api.service';
import { SettingsService } from '../../core/settings.service';
import { formatDistance } from '../plan/severity';

/**
 * F-007 P1 "Driving" — VIEW-ONLY on web (recording is iOS-only for 3.0.0, per the plan): the
 * per-user stats rollup, the recorded drives list, and the garage. Everything shown comes from
 * the server (`/v1/me/stats`, `/v1/drives`, `/v1/vehicles`) — no client-side stat math.
 */
@Component({
  selector: 'app-driving',
  imports: [RouterLink],
  template: `
    <div class="page">
      <header class="top">
        <a routerLink="/app" class="back" aria-label="Back">←</a>
        <h1>Driving</h1>
      </header>

      @if (stats(); as s) {
        <div class="tiles">
          <div class="tile">
            <span class="value">{{ dist(s.total_distance_meters) }}</span>
            <span class="label">Distance</span>
          </div>
          <div class="tile">
            <span class="value">{{ s.drive_count }}</span>
            <span class="label">Drives</span>
          </div>
          <div class="tile">
            <span class="value">{{ hours(s.total_duration_seconds) }}</span>
            <span class="label">Time</span>
          </div>
        </div>
        @if (s.regions?.length; as n) {
          <p class="regions">
            <strong>{{ n }} {{ n === 1 ? 'state' : 'states' }} driven:</strong>
            {{ regionList(s.regions!) }}
          </p>
        }
      }

      <h2>Recorded drives</h2>
      @if (drives().length) {
        @for (d of drives(); track d.id) {
          <div class="row">
            <span class="names">{{ title(d) }}</span>
            <span class="sub">{{ when(d.started_at) }}</span>
            <span class="sub">{{ dist(d.distance_meters) }} · {{ hours(d.moving_seconds) }} moving</span>
          </div>
        }
      } @else if (loading()) {
        <p class="empty">Loading your drives…</p>
      } @else {
        <p class="empty">
          No recorded drives yet. Recording lives in the iOS app — flip on “Record this drive”
          before you start; your drives and stats show up here.
        </p>
      }

      <h2>Garage</h2>
      @if (vehicles().length) {
        @for (v of vehicles(); track v.id) {
          <div class="row">
            <span class="names">{{ vehicleTitle(v) }}</span>
            <span class="sub">{{ vehicleSub(v) }}</span>
          </div>
        }
      } @else if (!loading()) {
        <p class="empty">No vehicles yet. Add your car in the iOS app's Garage.</p>
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
      .tiles {
        display: flex;
        gap: 8px;
        margin-bottom: 10px;
      }
      .tile {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: 14px 8px;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface);
      }
      .value {
        font-weight: 700;
        font-size: 18px;
      }
      .label {
        color: var(--muted);
        font-size: 12px;
      }
      .regions {
        color: var(--muted);
        font-size: 13px;
        margin: 0 2px 6px;
      }
      .row {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 12px 14px;
        margin-bottom: 8px;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface);
      }
      .names {
        font-weight: 600;
        font-size: 15px;
      }
      .sub {
        color: var(--muted);
        font-size: 13px;
      }
      .empty {
        color: var(--muted);
        font-size: 14px;
        padding: 4px 2px 8px;
      }
    `,
  ],
})
export class Driving {
  private readonly api = inject(ApiService);
  private readonly settings = inject(SettingsService);

  readonly stats = signal<MeStatsResponse | null>(null);
  readonly drives = signal<DriveModel[]>([]);
  readonly vehicles = signal<VehicleModel[]>([]);
  readonly loading = signal(true);

  constructor() {
    void this.refresh();
  }

  private async refresh(): Promise<void> {
    try {
      const [stats, drives, vehicles] = await Promise.all([
        this.api.myStats(),
        this.api.listDrives(),
        this.api.listVehicles(),
      ]);
      this.stats.set(stats);
      this.drives.set(drives.drives);
      this.vehicles.set(vehicles.vehicles);
    } finally {
      this.loading.set(false);
    }
  }

  title(d: DriveModel): string {
    if (d.title) return d.title;
    const from = d.start_place ?? 'Drive';
    return d.end_place ? `${from} → ${d.end_place}` : from;
  }

  when(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  dist(m: number): string {
    return formatDistance(m, this.settings.units());
  }

  hours(seconds: number): string {
    const m = Math.round(seconds / 60);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${Math.max(m, 0)} min`;
  }

  regionList(codes: string[]): string {
    return codes.map((c) => c.replace('US-', '')).join(' · ');
  }

  vehicleTitle(v: VehicleModel): string {
    return [v.year, v.make, v.model].filter(Boolean).join(' ');
  }

  vehicleSub(v: VehicleModel): string {
    return [v.trim, v.color, v.vehicle_type].filter(Boolean).join(' · ');
  }
}
