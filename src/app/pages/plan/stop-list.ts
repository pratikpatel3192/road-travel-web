import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { IconComponent } from '../../ui/icon';
import { PlaceField, type PlaceValue } from './place-field';
import {
  DWELL_PRESETS,
  type DwellMinutes,
  MAX_NIGHTS,
  MAX_STOPS,
  type StopDraft,
  newStop,
  normalizeNights,
} from './waypoints';

/**
 * F-006: the ordered stop rows between the origin and destination fields — up to {@link MAX_STOPS}
 * stops, each with a place autocomplete (same pattern as origin/destination), up/down reorder, and
 * remove. Emits a fresh array on every edit so the planner can debounce a re-plan. Mirrors the iOS
 * stop editor (parity, ADR-0016).
 *
 * Each row asks for nights first, because the answer decides what the next question is: a
 * pass-through is described by how long it lasts, an overnight stay by what time you set off the
 * next morning. Only one of the two is ever on screen — a row showing both would be asking the
 * traveller to describe the same stop twice, in two vocabularies.
 */
@Component({
  selector: 'app-stop-list',
  imports: [FormsModule, PlaceField, IconComponent],
  template: `
    @for (s of stops(); track s.id; let i = $index; let last = $last) {
      <div class="stop-row">
        <div class="stop-field">
          <app-place-field
            kind="stop"
            [index]="i + 1"
            [placeholder]="'Stop ' + (i + 1)"
            [place]="s.place"
            [near]="near()"
            (placeChange)="setPlace(i, $event)"
          />
          <button class="tool remove" type="button" (click)="remove(i)" [attr.aria-label]="'Remove stop ' + (i + 1)">
            <app-icon name="x" [size]="14" />
          </button>
        </div>
        <div class="stop-tools">
          <div class="stay">
            <label class="nights">
              <span>Nights</span>
              <input
                type="number"
                min="0"
                [max]="maxNights"
                step="1"
                [ngModel]="s.nights"
                (ngModelChange)="setNights(i, $event)"
                [name]="'nights-' + s.id"
                [attr.aria-label]="'Nights at stop ' + (i + 1)"
              />
            </label>
            @if (s.nights > 0) {
              <!-- An overnight stop is described by when you LEAVE it. Asking "how long?" about a
                   three-night stay is the wrong question, so the dwell picker is gone, not
                   disabled. -->
              <label class="depart">
                <span>Leave at</span>
                <input
                  type="time"
                  [ngModel]="s.departureTime ?? ''"
                  (ngModelChange)="setDepartureTime(i, $event)"
                  [name]="'depart-' + s.id"
                  [attr.aria-label]="'Departure time from stop ' + (i + 1)"
                  title="Blank is fine — we'll treat it as sometime that day rather than guess an hour."
                />
              </label>
            } @else {
              <label class="dwell">
                <span>Stop for</span>
                <select
                  [ngModel]="s.dwellMinutes"
                  (ngModelChange)="setDwell(i, $event)"
                  [name]="'dwell-' + s.id"
                  [attr.aria-label]="'Stop ' + (i + 1) + ' dwell time'"
                >
                  @for (m of presets; track m) {
                    <option [ngValue]="m">{{ m === 0 ? 'Pass through' : m + ' min' }}</option>
                  }
                </select>
              </label>
            }
          </div>
          <button
            class="tool"
            type="button"
            (click)="move(i, -1)"
            [disabled]="i === 0"
            [attr.aria-label]="'Move stop ' + (i + 1) + ' earlier'"
          >
            <app-icon name="arrow-up" [size]="14" />
          </button>
          <button
            class="tool"
            type="button"
            (click)="move(i, 1)"
            [disabled]="last"
            [attr.aria-label]="'Move stop ' + (i + 1) + ' later'"
          >
            <app-icon name="arrow-down" [size]="14" />
          </button>
        </div>
        <div class="divider"></div>
      </div>
    }
    @if (stops().length < max) {
      <button class="add" type="button" (click)="add()">+ Add stop</button>
      <div class="divider"></div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .stop-field {
        display: flex;
        align-items: center;
      }
      app-place-field {
        flex: 1;
        min-width: 0;
      }
      .stop-tools {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px 12px 50px;
      }
      /* Nights + the one question that follows from it, wrapping together when the panel is
         narrow — with 23 stops possible the row has to survive being cramped. */
      .stay {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px 8px;
        margin-right: auto;
        min-width: 0;
      }
      .dwell,
      .nights,
      .depart {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 600;
        color: var(--muted);
      }
      .dwell select,
      .nights input,
      .depart input {
        padding: 6px 12px;
        border: 1px solid var(--border);
        border-radius: var(--radius-pill);
        font: 600 12.5px var(--font-body);
        background: var(--surface-2);
        color: var(--text);
        cursor: pointer;
        transition: border-color 150ms ease-out;
      }
      .dwell select:hover,
      .nights input:hover,
      .depart input:hover {
        border-color: var(--border-strong);
      }
      .nights input {
        width: 52px;
        padding-right: 4px;
      }
      .depart input {
        padding: 5px 10px;
      }
      .tool {
        width: 28px;
        height: 28px;
        display: grid;
        place-items: center;
        border: none;
        border-radius: var(--radius-pill);
        background: var(--surface-2);
        color: var(--muted);
        cursor: pointer;
        padding: 0;
        transition: background 150ms ease-out, color 150ms ease-out;
      }
      .tool:hover:not(:disabled) {
        background: var(--border);
        color: var(--text);
      }
      .tool:disabled {
        opacity: 0.45;
        cursor: default;
      }
      .tool.remove {
        margin-right: 8px;
      }
      .add {
        display: block;
        width: 100%;
        text-align: left;
        border: none;
        background: transparent;
        color: var(--link);
        font: 700 14px var(--font-body);
        padding: 10px 12px 10px 50px;
        cursor: pointer;
        transition: color 150ms ease-out;
      }
      .add:hover {
        color: var(--link-hover);
      }
      .divider {
        height: 1px;
        background: var(--border);
        margin-left: 50px;
      }
    `,
  ],
})
export class StopList {
  /** The ordered stop rows — two-way bound; every edit emits a fresh array (`stopsChange`). */
  readonly stops = model<StopDraft[]>([]);
  /** Proximity bias for stop autocomplete — the route midpoint, so suggestions stay near the trip. */
  readonly near = input<{ latitude: number; longitude: number } | null>(null);

  readonly presets = DWELL_PRESETS;
  readonly max = MAX_STOPS;
  readonly maxNights = MAX_NIGHTS;

  add(): void {
    if (this.stops().length >= MAX_STOPS) return;
    this.stops.set([...this.stops(), newStop()]);
  }

  remove(index: number): void {
    this.stops.set(this.stops().filter((_, i) => i !== index));
  }

  move(index: number, delta: -1 | 1): void {
    const next = [...this.stops()];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    this.stops.set(next);
  }

  setPlace(index: number, place: PlaceValue | null): void {
    this.stops.set(this.stops().map((s, i) => (i === index ? { ...s, place } : s)));
  }

  setDwell(index: number, dwellMinutes: DwellMinutes): void {
    this.stops.set(this.stops().map((s, i) => (i === index ? { ...s, dwellMinutes } : s)));
  }

  /**
   * Dropping to a pass-through clears the morning's departure time with it: a time to leave a
   * place nobody sleeps at describes nothing, and the server rejects the pair. The dwell is left
   * alone in the draft so flipping nights back to 0 restores the stop the traveller had set up —
   * it is already omitted from the wire while the stay lasts (see `toWaypoints`).
   */
  setNights(index: number, nights: number): void {
    const value = normalizeNights(nights);
    this.stops.set(
      this.stops().map((s, i) =>
        i === index
          ? { ...s, nights: value, departureTime: value > 0 ? s.departureTime : null }
          : s,
      ),
    );
  }

  setDepartureTime(index: number, departureTime: string): void {
    this.stops.set(
      this.stops().map((s, i) =>
        i === index ? { ...s, departureTime: departureTime || null } : s,
      ),
    );
  }
}
