import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';

import { IconComponent } from '../../ui/icon';
import { departureHasPassed, forecastAgeLabel } from './trip-snapshot';

/**
 * The date on a result opened from its stored snapshot: "Forecast from 3 hours ago · Refresh".
 *
 * A snapshot is shown precisely so opening a trip costs nothing, and the price of that is that the
 * weather on screen is not current. Saying how old it is, right where the result starts, is what
 * keeps a stored forecast from being read as a live one — and the Refresh sits in the same line so
 * the remedy is where the doubt is.
 *
 * Once the trip's departure has gone the age is the wrong thing to say: a forecast for a drive that
 * already left is not merely old, it is about a moment that is over. The line becomes a warning.
 */
@Component({
  selector: 'app-snapshot-line',
  imports: [IconComponent],
  template: `
    @if (passed()) {
      <p class="line warn" role="status" [title]="exact()">
        <span class="ic" aria-hidden="true"><app-icon name="triangle-alert" [size]="13" /></span>
        <span
          >This trip's departure has passed —
          <button type="button" (click)="refresh.emit()" [disabled]="busy()">Refresh</button> to
          plan it from now.</span
        >
      </p>
    } @else {
      <p class="line" [title]="exact()">
        <span class="ic" aria-hidden="true"><app-icon name="clock-3" [size]="13" /></span>
        <span
          >{{ age() }} ·
          <button type="button" (click)="refresh.emit()" [disabled]="busy()">Refresh</button></span
        >
      </p>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      /* Theme tokens only. The planner's other notes lean on --well/--text-secondary, which no
         theme defines, so they fall back to a cream strip on the dark map too; a line that dates
         the whole result should not glare. */
      .line {
        display: flex;
        align-items: flex-start;
        gap: 7px;
        margin: 12px 0 0;
        padding: 8px 12px;
        border-radius: 10px;
        background: var(--surface);
        box-shadow: var(--shadow-sm);
        color: var(--muted);
        font-size: 13px;
        font-weight: 600;
      }
      .line.warn {
        border: 1.5px solid var(--sev-caution);
        color: var(--text);
      }
      .line.warn .ic {
        color: var(--sev-high);
      }
      .ic {
        display: inline-flex;
        padding-top: 2px;
      }
      button {
        border: none;
        background: none;
        padding: 0;
        font: inherit;
        font-weight: 700;
        color: var(--link);
        text-decoration: underline;
        text-underline-offset: 2px;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.5;
        cursor: default;
      }
    `,
  ],
})
export class SnapshotLine {
  /** When the stored forecast was fetched (ISO). */
  readonly plannedAt = input.required<string>();
  /** The departure the stored plan was made for (ISO). */
  readonly departureAt = input.required<string>();
  /** A plan is in flight — Refresh would only queue a second one. */
  readonly busy = input(false);
  readonly refresh = output<void>();

  /**
   * Ticks, so "5 minutes ago" does not stay five minutes for as long as the tab is open, and a
   * departure that passes while the traveller reads turns the line into the warning by itself.
   */
  private readonly now = signal(Date.now());

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  readonly age = computed(() => forecastAgeLabel(this.plannedAt(), this.now()));
  readonly passed = computed(() => departureHasPassed(this.departureAt(), this.now()));
  /** The exact moment, for the tooltip — the relative phrase is deliberately coarse. */
  readonly exact = computed(
    () =>
      `Forecast fetched ${new Date(this.plannedAt()).toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })}`,
  );
}
