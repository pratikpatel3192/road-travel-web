import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type {
  DriveModel,
  FriendshipModel,
  MeStatsResponse,
  SharedDriveModel,
  VehicleModel,
} from '@road-travel/sdk';

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
        <a routerLink="/chats" class="chats-link">
          Chats
          @if (unreadTotal()) {
            <span class="unread">{{ unreadTotal() }}</span>
          }
          →
        </a>
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

      <h2>Friends</h2>
      <form class="add" (submit)="sendRequest($event)">
        <input
          type="email"
          placeholder="Friend's email"
          [value]="email()"
          (input)="email.set($any($event.target).value)"
          autocomplete="off"
        />
        <button type="submit" [disabled]="busy() || !email().includes('@')">
          {{ busy() ? 'Sending…' : 'Add friend' }}
        </button>
      </form>
      @if (notice(); as n) {
        <p class="notice">{{ n }}</p>
      }
      @if (friendError(); as e) {
        <p class="error">{{ e }}</p>
      }

      @if (incoming().length) {
        <h3>Requests</h3>
        @for (f of incoming(); track f.id) {
          <div class="row actions-row">
            <span class="names">{{ friendName(f) }}</span>
            <span class="actions">
              <button class="act accept" (click)="respond(f, true)">Accept</button>
              <button class="act" (click)="respond(f, false)">Decline</button>
            </span>
          </div>
        }
      }

      @if (friends().length) {
        @for (f of friends(); track f.id) {
          <div class="friend">
            <div class="row actions-row">
              <button class="open bare" (click)="toggleFriend(f)">
                <span class="names">{{ friendName(f) }}</span>
                <span class="sub">{{ expanded() === f.id ? 'hide' : 'shared drives' }}</span>
              </button>
              <span class="actions">
                <button class="act accept" (click)="message(f)">Message</button>
                <button class="act" (click)="remove(f)">Unfriend</button>
                <button class="act warn" (click)="block(f)">Block</button>
              </span>
            </div>
            @if (expanded() === f.id) {
              @for (d of sharedDrives(); track d.id) {
                <div class="row shared">
                  <span class="names">
                    {{ sharedTitle(d) }}
                    @if (d.trip_worst_severity && d.trip_worst_severity !== 'clear') {
                      <span class="sev" [class.severe]="d.trip_worst_severity === 'severe'">
                        {{ d.trip_worst_severity }}
                      </span>
                    }
                  </span>
                  <span class="sub">{{ when(d.started_at) }} · {{ dist(d.distance_meters) }}</span>
                  @if (d.vehicle; as v) {
                    <span class="sub">🚗 {{ [v.year, v.color, v.make, v.model].join(' ').trim() }}</span>
                  }
                </div>
              } @empty {
                <p class="empty">
                  {{ sharedLoading() ? 'Loading…' : 'No shared drives yet.' }}
                </p>
              }
            }
          </div>
        }
      } @else if (!loading()) {
        <p class="empty">No friends yet — add someone by email above.</p>
      }

      @if (outgoing().length) {
        <h3>Sent</h3>
        @for (f of outgoing(); track f.id) {
          <div class="row actions-row">
            <span class="names">{{ friendName(f) }} <span class="sub">pending</span></span>
            <span class="actions">
              <button class="act" (click)="remove(f)">Cancel</button>
            </span>
          </div>
        }
      }

      @if (blocked().length) {
        <h3>Blocked by you</h3>
        @for (f of blocked(); track f.id) {
          <div class="row actions-row">
            <span class="names">{{ friendName(f) }}</span>
            <span class="actions">
              <button class="act" (click)="remove(f)">Unblock</button>
            </span>
          </div>
        }
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
      .chats-link {
        margin-left: auto;
        font-size: 14px;
        font-weight: 600;
      }
      .unread {
        display: inline-block;
        min-width: 18px;
        padding: 1px 5px;
        border-radius: 999px;
        background: var(--accent);
        color: var(--accent-contrast);
        font-size: 11px;
        font-weight: 700;
        text-align: center;
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
      .friend {
        margin-bottom: 8px;
      }
      .open {
        width: 100%;
        display: flex;
        justify-content: space-between;
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
      .shared {
        margin: 6px 0 0 18px;
      }
      .sev {
        display: inline-block;
        margin-left: 6px;
        padding: 1px 8px;
        border-radius: 999px;
        background: var(--sev-caution);
        color: #fff;
        font-size: 11px;
        font-weight: 700;
      }
      .sev.severe {
        background: var(--sev-severe);
      }
      h3 {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--muted);
        margin: 14px 0 6px;
      }
      .add {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
      }
      .add input {
        flex: 1;
        padding: 10px 12px;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface);
        color: var(--text);
        font: inherit;
      }
      .add button {
        padding: 10px 14px;
        border: none;
        border-radius: var(--radius);
        background: var(--accent);
        color: var(--accent-contrast);
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }
      .add button:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .notice {
        color: var(--muted);
        font-size: 13px;
        margin: 0 2px 6px;
      }
      .error {
        color: var(--sev-severe);
        font-size: 13px;
        margin: 0 2px 6px;
      }
      .actions-row {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .actions {
        display: flex;
        gap: 6px;
        flex: 0 0 auto;
      }
      .act {
        padding: 6px 10px;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface);
        color: var(--text);
        font: inherit;
        font-size: 13px;
        cursor: pointer;
      }
      .act:hover {
        border-color: var(--accent);
      }
      .act.accept {
        border-color: var(--accent);
        color: var(--accent);
        font-weight: 600;
      }
      .act.warn:hover {
        border-color: var(--sev-severe);
        color: var(--sev-severe);
      }
      .open.bare {
        border: none;
        background: none;
        padding: 0;
        flex: 1;
        display: flex;
        justify-content: space-between;
        gap: 10px;
      }
    `,
  ],
})
export class Driving {
  private readonly api = inject(ApiService);
  private readonly settings = inject(SettingsService);
  private readonly router = inject(Router);

  readonly stats = signal<MeStatsResponse | null>(null);
  readonly drives = signal<DriveModel[]>([]);
  readonly vehicles = signal<VehicleModel[]>([]);
  readonly friends = signal<FriendshipModel[]>([]);
  readonly incoming = signal<FriendshipModel[]>([]);
  readonly outgoing = signal<FriendshipModel[]>([]);
  readonly blocked = signal<FriendshipModel[]>([]);
  readonly expanded = signal<string | null>(null);
  readonly sharedDrives = signal<SharedDriveModel[]>([]);
  readonly sharedLoading = signal(false);
  readonly loading = signal(true);
  readonly email = signal('');
  readonly busy = signal(false);
  readonly notice = signal<string | null>(null);
  readonly friendError = signal<string | null>(null);
  readonly unreadTotal = signal(0);

  constructor() {
    void this.refresh();
  }

  private async refresh(): Promise<void> {
    try {
      const [stats, drives, vehicles, graph] = await Promise.all([
        this.api.myStats(),
        this.api.listDrives(),
        this.api.listVehicles(),
        this.api.listFriends(),
      ]);
      this.stats.set(stats);
      this.drives.set(drives.drives);
      this.vehicles.set(vehicles.vehicles);
      this.friends.set(graph.friends ?? []);
      this.incoming.set(graph.incoming ?? []);
      this.outgoing.set(graph.outgoing ?? []);
      this.blocked.set(graph.blocked ?? []);
    } finally {
      this.loading.set(false);
    }
    // Unread badge for the Chats link — best-effort, never blocks the page.
    try {
      const convos = await this.api.listConversations();
      this.unreadTotal.set(
        convos.conversations.reduce((sum, c) => sum + (c.unread_count ?? 0), 0),
      );
    } catch {
      /* badge is cosmetic */
    }
  }

  friendName(f: FriendshipModel): string {
    return f.friend.display_name || f.friend.email || 'Friend';
  }

  // --- friend management (parity with iOS — user decision 2026-07-19) ---

  sendRequest(event: Event): void {
    event.preventDefault();
    const address = this.email().trim();
    if (!address || this.busy()) return;
    this.busy.set(true);
    this.notice.set(null);
    this.friendError.set(null);
    void this.api
      .requestFriend(address)
      .then(() => {
        this.notice.set(`Request sent to ${address}.`);
        this.email.set('');
        return this.refresh();
      })
      .catch((e: unknown) => {
        // 404 (no account / blocked — indistinguishable by design), 409, or 429.
        this.friendError.set(
          e instanceof Error && e.message ? e.message : 'Couldn’t send that request.',
        );
      })
      .finally(() => this.busy.set(false));
  }

  respond(f: FriendshipModel, accept: boolean): void {
    void this.api
      .respondFriend(f.id, accept)
      .then(() => this.refresh())
      .catch(() => this.friendError.set('Couldn’t update that request.'));
  }

  remove(f: FriendshipModel): void {
    if (this.expanded() === f.id) this.expanded.set(null);
    void this.api
      .removeFriend(f.id)
      .then(() => this.refresh())
      .catch(() => this.friendError.set('Couldn’t update that friendship.'));
  }

  block(f: FriendshipModel): void {
    if (this.expanded() === f.id) this.expanded.set(null);
    void this.api
      .blockFriend(f.id)
      .then(() => this.refresh())
      .catch(() => this.friendError.set('Couldn’t block that user.'));
  }

  /** F-007 P3 M8: open (or dedupe into) this friend's DM, then land on the thread. */
  message(f: FriendshipModel): void {
    void this.api
      .openDm(f.id)
      .then((convo) => this.router.navigate(['/chats'], { queryParams: { open: convo.id } }))
      .catch(() => this.friendError.set('Couldn’t open that chat.'));
  }

  toggleFriend(f: FriendshipModel): void {
    if (this.expanded() === f.id) {
      this.expanded.set(null);
      return;
    }
    this.expanded.set(f.id);
    this.sharedDrives.set([]);
    this.sharedLoading.set(true);
    void this.api
      .friendDrives(f.id)
      .then((r) => {
        if (this.expanded() === f.id) this.sharedDrives.set(r.drives);
      })
      .finally(() => this.sharedLoading.set(false));
  }

  sharedTitle(d: SharedDriveModel): string {
    if (d.title) return d.title;
    const from = d.start_place ?? 'Drive';
    return d.end_place ? `${from} → ${d.end_place}` : from;
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
