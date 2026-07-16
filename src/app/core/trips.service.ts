import { Injectable, effect, inject, signal } from '@angular/core';
import type { SavedTripModel } from '@road-travel/sdk';

import type { PlaceValue } from '../pages/plan/place-field';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

/** A trip queued from My Trips to prefill + auto-plan when the plan page opens. */
export interface StagedTrip {
  origin: PlaceValue;
  destination: PlaceValue;
  departureAt?: string;
}

/**
 * A locally-remembered recently-planned trip (My Trips → Recent). Web has no turn-by-turn drive, so
 * "recent" = trips you've planned/opened. Kept per-user in localStorage (device history — NOT synced;
 * saved trips remain the server-authoritative list). Mirrors the iOS Recent section.
 */
export interface RecentTrip {
  origin: PlaceValue;
  destination: PlaceValue;
  departureAt?: string;
  distanceMeters?: number;
  worstSeverity?: string;
  recordedAt: string;
}
const RECENT_LIMIT = 15;
const recentEndpointsKey = (o: PlaceValue, d: PlaceValue) => `${o.name}→${d.name}`;

// Legacy localStorage keys (pre-ADR-0029). The saved list is migrated to the server once per
// user; recents are removed outright.
const LEGACY_SAVED_KEY = 'rt.savedTrips';
const LEGACY_RECENTS_KEY = 'rt.recentTrips';
interface LegacySavedTrip {
  origin: PlaceValue;
  destination: PlaceValue;
  departureAt?: string;
  distanceMeters?: number;
  worstSeverity?: string;
}

const cacheKey = (userId: string) => `rt.savedTrips.v2.${userId}`;
const migratedKey = (userId: string) => `rt.savedTripsMigrated.${userId}`;
const recentKey = (userId: string) => `rt.recentTrips.v2.${userId}`;

/**
 * Server-authoritative saved trips (ADR-0029). `public.trips` via GET/POST/DELETE `/v1/trips` is
 * the single source of truth; localStorage survives only as a per-user offline READ cache that is
 * refreshed from every server response and dropped on sign-out. Recents are gone — My Trips is
 * Saved only. Pre-ADR-0029 localStorage saves are pushed to the API once per user, then the
 * legacy keys are deleted.
 */
@Injectable({ providedIn: 'root' })
export class TripsService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly saved = signal<SavedTripModel[]>([]);
  readonly recent = signal<RecentTrip[]>([]);
  readonly loading = signal(false);
  readonly staged = signal<StagedTrip | null>(null);

  private loadedFor: string | null = null;
  // In-flight guards so concurrent callers (the session effect + the Saved page both call
  // refresh) share ONE network round-trip and ONE migration — otherwise the legacy push runs
  // twice and duplicates every trip.
  private refreshInFlight: Promise<void> | null = null;
  private migration: Promise<boolean> | null = null;

  constructor() {
    // React to the session: load (cache-first) when a real account appears, clear on sign-out.
    effect(() => {
      const signedIn = this.auth.hasRealAccount();
      const userId = this.auth.userId;
      if (signedIn && userId) {
        if (this.loadedFor !== userId) {
          this.loadedFor = userId;
          this.saved.set(this.readCache(userId));
          this.recent.set(this.readRecent(userId));
          void this.refresh();
        }
      } else if (this.loadedFor !== null) {
        this.loadedFor = null;
        this.saved.set([]);
        this.recent.set([]);
      }
    });
  }

  /** Pull the authoritative list (after the one-time legacy migration, if still pending). */
  refresh(): Promise<void> {
    // Coalesce concurrent refreshes into one — the second caller awaits the first's result.
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.runRefresh().finally(() => {
        this.refreshInFlight = null;
      });
    }
    return this.refreshInFlight;
  }

  private async runRefresh(): Promise<void> {
    const userId = this.auth.userId;
    if (!userId) return;
    this.loading.set(true);
    try {
      let { trips } = await this.api.listTrips();
      if (await this.migrateLegacy(userId, trips)) {
        ({ trips } = await this.api.listTrips());
      }
      this.saved.set(trips);
      this.writeCache(userId, trips);
    } catch {
      // Offline / transient — keep whatever the cache gave us.
    } finally {
      this.loading.set(false);
    }
  }

  isSaved(origin: PlaceValue, destination: PlaceValue): boolean {
    return !!this.findByEndpoints(origin, destination);
  }

  /**
   * Save if new, delete if already saved (matched by endpoint names — the server id is the truth,
   * but the plan page only knows the current origin/destination). Returns the resulting state.
   */
  async toggleSave(trip: {
    origin: PlaceValue;
    destination: PlaceValue;
    departureAt: string;
    distanceMeters?: number;
    durationSeconds?: number;
    worstSeverity?: string;
  }): Promise<boolean> {
    const existing = this.findByEndpoints(trip.origin, trip.destination);
    if (existing) {
      await this.remove(existing.id);
      return false;
    }
    const saved = await this.api.saveTrip({
      origin: trip.origin,
      destination: trip.destination,
      departure_at: trip.departureAt,
      distance_meters: trip.distanceMeters ?? 0,
      duration_seconds: trip.durationSeconds ?? 0,
      worst_severity: trip.worstSeverity ?? 'clear',
    });
    this.saved.set([saved, ...this.saved()]);
    this.syncCache();
    return true;
  }

  async remove(id: string): Promise<void> {
    try {
      await this.api.deleteTrip(id);
    } catch (e) {
      // A 404 means it's already gone (deleted on another device) — treat as success.
      if ((e as { status?: number })?.status !== 404) throw e;
    }
    this.saved.set(this.saved().filter((t) => t.id !== id));
    this.syncCache();
  }

  stage(trip: StagedTrip): void {
    this.staged.set(trip);
  }
  /** Read and clear the staged trip (consumed once by the plan page). */
  takeStaged(): StagedTrip | null {
    const s = this.staged();
    this.staged.set(null);
    return s;
  }

  private findByEndpoints(origin: PlaceValue, destination: PlaceValue): SavedTripModel | undefined {
    return this.saved().find(
      (t) => t.origin_name === origin.name && t.destination_name === destination.name,
    );
  }

  /**
   * One-time push of pre-ADR-0029 localStorage saves to the server, then drop the legacy keys.
   * Deduped against the server list (by endpoint names) so a partially-failed run that retries
   * on the next load can never create duplicates. Returns whether anything was pushed.
   */
  private migrateLegacy(userId: string, existing: SavedTripModel[]): Promise<boolean> {
    // One migration per session even if refreshes overlap (the second awaits the first).
    if (!this.migration) this.migration = this.runMigration(userId, existing);
    return this.migration;
  }

  private async runMigration(userId: string, existing: SavedTripModel[]): Promise<boolean> {
    try {
      localStorage.removeItem(LEGACY_RECENTS_KEY); // recents are simply gone (ADR-0029)
      if (localStorage.getItem(migratedKey(userId))) return false;
      const raw = localStorage.getItem(LEGACY_SAVED_KEY);
      const legacy: LegacySavedTrip[] = raw ? JSON.parse(raw) : [];
      const onServer = new Set(existing.map((t) => `${t.origin_name}→${t.destination_name}`));
      let pushed = false;
      for (const t of legacy) {
        if (onServer.has(`${t.origin.name}→${t.destination.name}`)) continue;
        await this.api.saveTrip({
          origin: t.origin,
          destination: t.destination,
          departure_at: t.departureAt ?? new Date().toISOString(),
          distance_meters: t.distanceMeters ?? 0,
          duration_seconds: 0,
          worst_severity: t.worstSeverity ?? 'clear',
        });
        pushed = true;
      }
      localStorage.setItem(migratedKey(userId), new Date().toISOString());
      localStorage.removeItem(LEGACY_SAVED_KEY);
      return pushed;
    } catch {
      // Migration is retried on the next load; the marker is only set after full success.
      return false;
    }
  }

  private readCache(userId: string): SavedTripModel[] {
    try {
      const raw = localStorage.getItem(cacheKey(userId));
      return raw ? (JSON.parse(raw) as SavedTripModel[]) : [];
    } catch {
      return [];
    }
  }
  private writeCache(userId: string, trips: SavedTripModel[]): void {
    try {
      localStorage.setItem(cacheKey(userId), JSON.stringify(trips));
    } catch {
      /* storage unavailable — the server list still renders */
    }
  }
  private syncCache(): void {
    const userId = this.auth.userId;
    if (userId) this.writeCache(userId, this.saved());
  }

  // --- Recent trips (local, per-user; My Trips → Recent) --------------------------------------------

  /** Remember a planned/opened trip in Recent — upsert by endpoints (moves it to the top), cap 15. */
  recordRecent(trip: {
    origin: PlaceValue;
    destination: PlaceValue;
    departureAt?: string;
    distanceMeters?: number;
    worstSeverity?: string;
  }): void {
    const userId = this.auth.userId;
    if (!userId) return;
    const k = recentEndpointsKey(trip.origin, trip.destination);
    const entry: RecentTrip = { ...trip, recordedAt: new Date().toISOString() };
    const next = [
      entry,
      ...this.recent().filter((r) => recentEndpointsKey(r.origin, r.destination) !== k),
    ].slice(0, RECENT_LIMIT);
    this.recent.set(next);
    this.writeRecent(userId, next);
  }

  removeRecent(key: string): void {
    const next = this.recent().filter((r) => recentEndpointsKey(r.origin, r.destination) !== key);
    this.recent.set(next);
    const userId = this.auth.userId;
    if (userId) this.writeRecent(userId, next);
  }

  private readRecent(userId: string): RecentTrip[] {
    try {
      const raw = localStorage.getItem(recentKey(userId));
      return raw ? (JSON.parse(raw) as RecentTrip[]) : [];
    } catch {
      return [];
    }
  }
  private writeRecent(userId: string, recents: RecentTrip[]): void {
    try {
      localStorage.setItem(recentKey(userId), JSON.stringify(recents));
    } catch {
      /* storage unavailable — recents just won't persist */
    }
  }
}
