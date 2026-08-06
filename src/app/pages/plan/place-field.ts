import { Component, computed, effect, inject, input, model, signal } from '@angular/core';

import { type GeoResult, GeocodeService } from '../../core/geocode.service';
import { IconComponent } from '../../ui/icon';

export interface PlaceValue {
  name: string;
  latitude: number;
  longitude: number;
}

/**
 * One origin/destination field: type a place, pick from autocomplete suggestions (no coordinates) —
 * the web analogue of the iOS MapKit-search field. Two-way binds the selected `place`.
 */
@Component({
  selector: 'app-place-field',
  imports: [IconComponent],
  template: `
    <div class="field">
      <span
        class="dot"
        [class.origin]="kind() === 'origin'"
        [class.dest]="kind() === 'destination'"
        [class.stop]="kind() === 'stop'"
        >{{ kind() === 'stop' ? index() : '' }}</span
      >
      <input
        #input
        type="text"
        [placeholder]="placeholder()"
        [value]="query()"
        (input)="onInput(input.value)"
        (focus)="open.set(true)"
        (blur)="onBlur()"
        autocomplete="off"
        [attr.aria-label]="placeholder()"
      />
      @if (query()) {
        <button type="button" class="clear" (mousedown)="clear($event)" aria-label="Clear">
          <app-icon name="x" [size]="14" />
        </button>
      }

      @if (open() && (loading() || suggestions().length)) {
        <ul class="menu" role="listbox">
          @if (loading()) {
            <li class="hint">Searching…</li>
          }
          @for (s of suggestions(); track s.name + s.latitude) {
            <li role="option" (mousedown)="pick($event, s)">
              <app-icon name="map-pin" [size]="14" />
              {{ s.name }}
            </li>
          }
          @if (!loading() && !suggestions().length && query().length >= 3) {
            <li class="hint">No matches</li>
          }
        </ul>
      }
    </div>
  `,
  styles: [
    `
      .field {
        position: relative;
        display: flex;
        align-items: center;
        padding: 6px 12px;
      }
      .dot {
        position: absolute;
        left: 26px;
        z-index: 1;
        pointer-events: none;
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }
      .dot.origin {
        background: var(--origin-dot);
      }
      .dot.dest {
        background: var(--destination-dot);
      }
      /* F-006 stop rows: a numbered badge instead of the plain origin/destination dot. */
      .dot.stop {
        left: 21px;
        width: 20px;
        height: 20px;
        background: var(--accent-500);
        color: #ffffff;
        display: grid;
        place-items: center;
        font-size: 12px;
        font-weight: 700;
        line-height: 1;
      }
      input {
        flex: 1;
        min-width: 0;
        border: 1.5px solid var(--border);
        border-radius: var(--radius-pill);
        background: var(--surface);
        color: var(--text);
        font: 600 15px var(--font-body);
        padding: 11px 16px 11px 38px;
        transition: border-color 150ms ease-out;
      }
      input:focus {
        border-color: var(--accent);
      }
      input::placeholder {
        color: var(--muted);
        font-weight: 500;
      }
      .clear {
        position: absolute;
        right: 22px;
        display: grid;
        place-items: center;
        width: 24px;
        height: 24px;
        border: none;
        border-radius: 50%;
        background: transparent;
        color: var(--muted);
        cursor: pointer;
        padding: 0;
        transition: color 150ms ease-out;
      }
      .clear:hover {
        color: var(--text);
      }
      .menu {
        position: absolute;
        z-index: 20;
        top: calc(100% - 2px);
        left: 12px;
        right: 12px;
        list-style: none;
        margin: 0;
        padding: 6px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-md);
        max-height: 260px;
        overflow-y: auto;
      }
      .menu li {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 9px 10px;
        border-radius: var(--radius-sm);
        font-size: 14px;
        font-weight: 600;
        color: var(--text);
        cursor: pointer;
        transition: background 150ms ease-out;
      }
      .menu li app-icon {
        flex: 0 0 auto;
        color: var(--muted);
      }
      .menu li[role='option']:hover {
        background: var(--surface-2);
      }
      .hint {
        color: var(--muted);
        font-size: 12px;
        font-weight: 500;
        cursor: default;
      }
    `,
  ],
})
export class PlaceField {
  readonly kind = input<'origin' | 'destination' | 'stop'>('origin');
  /** 1-based stop number, rendered inside the badge (kind 'stop' only; F-006). */
  readonly index = input<number | null>(null);
  readonly placeholder = input('Search a place');
  readonly place = model<PlaceValue | null>(null);
  /** Proximity bias for autocomplete — rank suggestions near this point first (e.g. the route). */
  readonly near = input<{ latitude: number; longitude: number } | null>(null);

  private readonly geocode = inject(GeocodeService);
  readonly query = signal('');
  readonly suggestions = signal<GeoResult[]>([]);
  readonly loading = signal(false);
  readonly open = signal(false);
  private seq = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  readonly hasPlace = computed(() => !!this.place());

  constructor() {
    // Reflect an externally-set place (prefill / swap) into the visible text. Skips while the user
    // is typing (then `place` is null) and after a pick (name already equals the query).
    effect(() => {
      const p = this.place();
      if (p && p.name !== this.query()) this.query.set(p.name);
    });
  }

  onInput(value: string): void {
    this.query.set(value);
    this.open.set(true);
    if (this.place() && this.place()!.name !== value) this.place.set(null);
    clearTimeout(this.timer);
    if (value.trim().length < 3) {
      this.suggestions.set([]);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    const mine = ++this.seq;
    this.timer = setTimeout(async () => {
      const results = await this.geocode.search(value, this.near());
      if (mine !== this.seq) return; // a newer query superseded this one
      this.suggestions.set(results);
      this.loading.set(false);
    }, 250);
  }

  pick(event: Event, result: GeoResult): void {
    event.preventDefault(); // keep focus/selection before blur fires
    this.place.set({ name: result.name, latitude: result.latitude, longitude: result.longitude });
    this.query.set(result.name);
    this.suggestions.set([]);
    this.open.set(false);
  }

  clear(event: Event): void {
    event.preventDefault();
    this.query.set('');
    this.place.set(null);
    this.suggestions.set([]);
  }

  onBlur(): void {
    // Delay so a suggestion click (mousedown) resolves before the menu closes.
    setTimeout(() => this.open.set(false), 120);
  }

  /** Set the field from outside (used by swap / recents). */
  setPlace(value: PlaceValue | null): void {
    this.place.set(value);
    this.query.set(value?.name ?? '');
    this.suggestions.set([]);
  }
}
