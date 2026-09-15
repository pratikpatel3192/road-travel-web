import { Component, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { STOP_STAY_OPTIONS, stayById, stayIdFor } from '../../core/stop-stay';
import { IconComponent } from '../../ui/icon';
import { PlaceField, type PlaceValue } from './place-field';
import { DEFAULT_STOP_DEPARTURE, formatClock, stayChipLabel } from './stops-summary';
import { type DwellMinutes, MAX_STOPS, type StopDraft, newStop } from './waypoints';

/**
 * F-006: the ordered stop rows of the stops editor — up to {@link MAX_STOPS} stops, each with a
 * place autocomplete (same pattern as origin/destination), up/down reorder, and remove. Emits a
 * fresh array on every edit. Mirrors the iOS stop editor (parity, ADR-0016).
 *
 * A row shows its stay as ONE chip ("Pass", "30 min", "2 nights · 8 AM") and edits it on tap. The
 * row used to carry the duration picker and the departure-time input side by side at all times,
 * which on a phone truncated the time to "An…" and made every stop two controls tall.
 *
 * The chip opens the duration first, because the answer decides what the next question is: a
 * pass-through is described by how long it lasts, an overnight stay by what time you set off the
 * next morning. Only a stay ever asks the second question.
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
            [clearable]="false"
            (placeChange)="setPlace(i, $event)"
          />
          <button
            class="tool remove"
            type="button"
            (click)="remove(i)"
            [attr.aria-label]="'Remove stop ' + (s.place?.name ?? i + 1)"
          >
            <app-icon name="x" [size]="14" />
          </button>
        </div>
        <div class="stop-tools">
          <button
            class="stay-chip"
            type="button"
            [class.open]="editing() === s.id"
            (click)="toggleStay(s.id)"
            [attr.aria-expanded]="editing() === s.id"
            [attr.aria-label]="'Stop ' + (i + 1) + ' stay: ' + chip(s)"
          >
            {{ chip(s) }}
            <app-icon [name]="editing() === s.id ? 'chevron-up' : 'chevron-down'" [size]="13" />
          </button>
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
        @if (editing() === s.id) {
          <div class="stay">
            <!-- ONE duration control. This was a nights box beside a "Stop for" select, and at
                 zero they both read as passing through — the same question asked twice, in two
                 different shapes. A pause and a stay are the same thought at different lengths. -->
            <label class="dwell">
              <span>Stop for</span>
              <select
                [ngModel]="stayIdFor(s.dwellMinutes, s.nights)"
                (ngModelChange)="setStay(i, $event)"
                [name]="'stay-' + s.id"
                [attr.aria-label]="'Stop ' + (i + 1) + ' duration'"
              >
                @for (o of stayOptions; track o.id) {
                  <option [ngValue]="o.id">{{ o.label }}</option>
                }
              </select>
            </label>
            @if (s.nights > 0) {
              <!-- Shows the server's 08:00 when nobody chose, but stores nothing: an untouched
                   time is not sent, so the day is planned at whatever the server's default is
                   and this label cannot disagree with the forecast it sits above. -->
              <label class="depart">
                <span>Leave at</span>
                <input
                  type="time"
                  [ngModel]="s.departureTime ?? defaultDeparture"
                  (ngModelChange)="setDepartureTime(i, $event)"
                  [name]="'depart-' + s.id"
                  [attr.aria-label]="'Departure time from stop ' + (i + 1)"
                />
              </label>
              @if (!s.departureTime) {
                <span class="default">{{ defaultLabel }} unless you pick a time</span>
              }
            }
          </div>
        }
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
        padding: 2px 12px 10px 50px;
      }
      .stay-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-right: auto;
        padding: 6px 10px 6px 12px;
        border: 1px solid var(--border);
        border-radius: var(--radius-pill);
        background: var(--surface-2);
        color: var(--text);
        font: 600 13px var(--font-body);
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
        cursor: pointer;
      }
      .stay-chip:hover,
      .stay-chip.open {
        border-color: var(--border-strong);
      }
      .stay {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px 12px;
        padding: 0 12px 12px 50px;
      }
      .dwell,
      .depart {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 600;
        color: var(--muted);
      }
      .dwell select,
      .depart input {
        padding: 6px 12px;
        border: 1px solid var(--border);
        border-radius: var(--radius-pill);
        font: 600 13px var(--font-body);
        background: var(--surface-2);
        color: var(--text);
        cursor: pointer;
      }
      .default {
        flex-basis: 100%;
        font-size: 12px;
        color: var(--muted);
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
        padding: 12px 12px 12px 50px;
        cursor: pointer;
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

  readonly stayOptions = STOP_STAY_OPTIONS;
  readonly max = MAX_STOPS;
  readonly defaultDeparture = DEFAULT_STOP_DEPARTURE;
  readonly defaultLabel = formatClock(DEFAULT_STOP_DEPARTURE);

  /** The row whose stay is open, by row id so it follows the stop through a reorder. */
  readonly editing = signal<number | null>(null);

  /** Template helper: which option the two stored fields currently mean. */
  stayIdFor(dwellMinutes: number, nights: number): string {
    return stayIdFor(dwellMinutes, nights);
  }

  chip(stop: StopDraft): string {
    return stayChipLabel(stop);
  }

  /** One stay open at a time — two open editors would put the rows back to two controls each. */
  toggleStay(id: number): void {
    this.editing.set(this.editing() === id ? null : id);
  }

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

  /**
   * One selection sets both stored fields, which is what keeps them mutually exclusive: the server
   * rejects a stop carrying a dwell AND nights, and picking from a single list cannot produce one.
   *
   * Choosing a pause clears the morning's departure time with it — a time to leave a place nobody
   * sleeps at describes nothing.
   */
  setStay(index: number, id: string): void {
    const option = stayById(id);
    this.stops.set(
      this.stops().map((s, i) =>
        i === index
          ? {
              ...s,
              dwellMinutes: option.dwellMinutes as DwellMinutes,
              nights: option.nights,
              departureTime: option.nights > 0 ? s.departureTime : null,
            }
          : s,
      ),
    );
  }

  /**
   * A cleared input goes back to null — the server's default — rather than to a stored "08:00",
   * so clearing it is how a traveller un-chooses a time.
   */
  setDepartureTime(index: number, departureTime: string): void {
    this.stops.set(
      this.stops().map((s, i) =>
        i === index ? { ...s, departureTime: departureTime || null } : s,
      ),
    );
  }
}
