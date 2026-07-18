import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

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
  imports: [FormsModule, PlaceField],
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
            ✕
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
            ↑
          </button>
          <button
            class="tool"
            type="button"
            (click)="move(i, 1)"
            [disabled]="last"
            [attr.aria-label]="'Move stop ' + (i + 1) + ' later'"
          >
            ↓
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
        gap: 6px;
        padding: 0 12px 10px 34px;
      }
      .dwell {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--muted);
        margin-right: auto;
      }
      .dwell select {
        padding: 5px 8px;
        border: 1px solid var(--border);
        border-radius: 8px;
        font: inherit;
        font-size: 12px;
        background: var(--surface);
        color: var(--text);
      }
      .tool {
        width: 26px;
        height: 26px;
        display: grid;
        place-items: center;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--surface);
        color: var(--muted);
        font-size: 13px;
        cursor: pointer;
        padding: 0;
      }
      .tool:hover:not(:disabled) {
        border-color: var(--accent);
        color: var(--text);
      }
      .tool:disabled {
        opacity: 0.35;
        cursor: default;
      }
      .tool.remove {
        border: none;
        background: transparent;
        font-size: 13px;
        margin-right: 8px;
      }
      .tool.remove:hover {
        color: var(--sev-severe);
      }
      .add {
        display: block;
        width: 100%;
        text-align: left;
        border: none;
        background: transparent;
        color: var(--accent);
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        padding: 10px 12px 10px 34px;
        cursor: pointer;
      }
      .add:hover {
        text-decoration: underline;
      }
      .divider {
        height: 1px;
        background: var(--border);
        margin-left: 34px;
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
