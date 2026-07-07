import { Injectable, signal } from '@angular/core';

import type { PlaceValue } from '../pages/plan/place-field';
import type { Severity } from '../pages/plan/severity';

export interface RecentTrip {
  origin: PlaceValue;
  destination: PlaceValue;
  at: number;
}

export interface SavedTrip {
  id: string; // "originName→destinationName"
  origin: PlaceValue;
  destination: PlaceValue;
  departureAt?: string; // ISO
  distanceMeters?: number;
  worstSeverity?: Severity;
  at: number;
}

/** A trip queued from Recents/Saved to prefill + auto-plan when the plan page opens. */
export interface StagedTrip {
  origin: PlaceValue;
  destination: PlaceValue;
  departureAt?: string;
}

const RECENTS_KEY = 'rt.recentTrips';
const SAVED_KEY = 'rt.savedTrips';
const RECENTS_CAP = 10; // matches iOS RecentTripsStore

/**
 * Recent + saved trips, persisted to localStorage — the web analogue of iOS's RecentTripsStore and
 * TripStore. Recents are capped at 10, deduped by endpoints, newest-first. Saved trips are unlimited
 * on web (no paywall) and re-planned fresh when reopened.
 */
@Injectable({ providedIn: 'root' })
export class TripsService {
  readonly recents = signal<RecentTrip[]>(this.load<RecentTrip[]>(RECENTS_KEY, []));
  readonly saved = signal<SavedTrip[]>(this.load<SavedTrip[]>(SAVED_KEY, []));
  readonly staged = signal<StagedTrip | null>(null);

  private tripId(o: PlaceValue, d: PlaceValue): string {
    return `${o.name}→${d.name}`;
  }

  addRecent(origin: PlaceValue, destination: PlaceValue): void {
    const id = this.tripId(origin, destination);
    const next = [
      { origin, destination, at: Date.now() },
      ...this.recents().filter((r) => this.tripId(r.origin, r.destination) !== id),
    ].slice(0, RECENTS_CAP);
    this.recents.set(next);
    this.persist(RECENTS_KEY, next);
  }

  removeRecent(at: number): void {
    const next = this.recents().filter((r) => r.at !== at);
    this.recents.set(next);
    this.persist(RECENTS_KEY, next);
  }

  isSaved(origin: PlaceValue, destination: PlaceValue): boolean {
    const id = this.tripId(origin, destination);
    return this.saved().some((s) => s.id === id);
  }

  /** Save if new, remove if already saved. Returns the resulting saved-state. */
  toggleSave(trip: Omit<SavedTrip, 'id' | 'at'>): boolean {
    const id = this.tripId(trip.origin, trip.destination);
    if (this.saved().some((s) => s.id === id)) {
      this.remove(id);
      return false;
    }
    const next = [{ ...trip, id, at: Date.now() }, ...this.saved()];
    this.saved.set(next);
    this.persist(SAVED_KEY, next);
    return true;
  }

  remove(id: string): void {
    const next = this.saved().filter((s) => s.id !== id);
    this.saved.set(next);
    this.persist(SAVED_KEY, next);
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

  private load<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }
  private persist(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable — trips just won't persist */
    }
  }
}
