import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { IconComponent } from '../../ui/icon';
import { PlaceField, type PlaceValue } from './place-field';
import { DWELL_PRESETS, type DwellMinutes, MAX_STOPS, type StopDraft, newStop } from './waypoints';

/**
 * F-006: the ordered stop rows between the origin and destination fields — up to {@link MAX_STOPS}
 * stops, each with a place autocomplete (same pattern as origin/destination), a dwell preset
 * picker (0 = pass through), up/down reorder, and remove. Emits a fresh array on every edit so
 * the planner can debounce a re-plan. Mirrors the iOS stop editor (parity, ADR-0016).
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
      .dwell {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        font-weight: 600;
        color: var(--muted);
        margin-right: auto;
      }
      .dwell select {
        padding: 6px 12px;
        border: 1px solid var(--border);
        border-radius: var(--radius-pill);
        font: 600 12.5px var(--font-body);
        background: var(--surface-2);
        color: var(--text);
        cursor: pointer;
        transition: border-color 150ms ease-out;
      }
      .dwell select:hover {
        border-color: var(--border-strong);
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
}
