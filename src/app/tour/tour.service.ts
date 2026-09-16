import { Injectable, computed, signal } from '@angular/core';

import { type TourStep, type TourTarget, tourScript } from './tour-script';
import { isTourTargetRendered } from './tour-targets';

/**
 * Versioned so a rewritten tour can be shown again to people who finished this one — bump it only
 * when the tour changes enough to be worth interrupting them for.
 */
export const TOUR_STORAGE_KEY = 'rt.tour.planner.v1';

/**
 * - `pending`: never finished, and storage works — show it.
 * - `done`: finished (Skip, Done, Escape, or left mid-tour).
 * - `unavailable`: storage throws. The tour is then NEVER shown automatically: with nowhere to
 *   remember that it was dismissed, it would come back on every visit, which is worse than not
 *   teaching at all.
 */
export type TourStatus = 'pending' | 'done' | 'unavailable';

export interface TourStartOptions {
  readonly signedIn: boolean;
  /** Settings' replay: show it even though it was finished (or storage is unavailable). */
  readonly force?: boolean;
  /** Injected for tests; the real check measures the rendered page. */
  readonly isRendered?: (target: TourTarget) => boolean;
}

/**
 * The tour's state: which steps, which one is showing, and whether it has been finished.
 *
 * Deliberately knows nothing about the planner. The planner decides WHEN a start is appropriate
 * (not over a handoff, a reopened trip, an open editor or a plan in flight) and the overlay decides
 * WHERE things are; this only sequences steps and remembers completion.
 */
@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly _steps = signal<readonly TourStep[]>([]);
  private readonly _index = signal(-1);
  private isRendered: (target: TourTarget) => boolean = isTourTargetRendered;
  private replayPending = false;

  readonly steps = this._steps.asReadonly();
  readonly index = this._index.asReadonly();
  readonly active = computed(() => this._index() >= 0 && this._index() < this._steps().length);
  readonly step = computed(() => (this.active() ? this._steps()[this._index()] : null));
  readonly isFirst = computed(() => this._index() === 0);
  readonly isLast = computed(() => this._index() === this._steps().length - 1);

  status(): TourStatus {
    try {
      if (localStorage.getItem(TOUR_STORAGE_KEY)) return 'done';
      // Reading can succeed where writing throws (Safari's old private mode, a full quota), and a
      // completion that cannot be written is the "every visit" failure — so probe the write too.
      const probe = `${TOUR_STORAGE_KEY}.probe`;
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return 'pending';
    } catch {
      return 'unavailable';
    }
  }

  shouldAutoStart(): boolean {
    return this.status() === 'pending';
  }

  /** Settings → "Show app tour": the planner picks this up on its next init. */
  requestReplay(): void {
    this.replayPending = true;
  }

  /** Read-once, so a later ordinary visit to the planner is not mistaken for a replay. */
  takeReplay(): boolean {
    const pending = this.replayPending;
    this.replayPending = false;
    return pending;
  }

  /**
   * Begin at step 1. Steps whose element is not on screen are dropped up front, and the counter
   * counts what is left — "3 of 5" followed by "5 of 5" reads as a bug. A guest has no My Trips
   * control at all (it is login-only, ADR-0025), so a guest's tour is four steps long.
   *
   * Returns whether anything was shown.
   */
  start(options: TourStartOptions): boolean {
    if (this.active()) return false;
    if (!options.force && !this.shouldAutoStart()) return false;
    this.isRendered = options.isRendered ?? isTourTargetRendered;
    const steps = tourScript(options.signedIn).filter((s) => this.isRendered(s.target));
    if (!steps.length) return false;
    this._steps.set(steps);
    this._index.set(0);
    return true;
  }

  next(): void {
    if (!this.active()) return;
    const at = this.nextRendered(this._index() + 1, 1);
    if (at === null) this.complete();
    else this._index.set(at);
  }

  back(): void {
    if (!this.active()) return;
    const at = this.nextRendered(this._index() - 1, -1);
    if (at !== null) this._index.set(at);
  }

  /**
   * The step on screen lost its element (a resize re-flowed it away). Move on rather than leave a
   * card pointing at nothing.
   */
  skipMissing(): void {
    if (!this.active()) return;
    const at = this.nextRendered(this._index() + 1, 1) ?? this.nextRendered(this._index() - 1, -1);
    if (at === null) this.complete();
    else this._index.set(at);
  }

  /** Skip, Escape, and Done all end here — each is an answer to "don't show me this again". */
  complete(): void {
    if (!this.active()) return;
    this._index.set(-1);
    this._steps.set([]);
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, new Date().toISOString());
    } catch {
      // Nothing to do: `status()` already reports unavailable storage, so it won't auto-show.
    }
  }

  /**
   * The planner went away with the tour up (Back, a typed URL). Counted as seen: the traveller
   * chose to leave it, and re-running it on their next visit would be the tour ignoring that.
   */
  abandon(): void {
    this.complete();
  }

  private nextRendered(from: number, dir: 1 | -1): number | null {
    const steps = this._steps();
    for (let i = from; i >= 0 && i < steps.length; i += dir) {
      if (this.isRendered(steps[i].target)) return i;
    }
    return null;
  }
}
