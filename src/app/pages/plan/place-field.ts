import { Component, computed, effect, inject, input, model, signal } from '@angular/core';

import { type GeoResult, GeocodeService } from '../../core/geocode.service';

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
        <button type="button" class="clear" (mousedown)="clear($event)" aria-label="Clear">×</button>
      }

      @if (open() && (loading() || suggestions().length)) {
        <ul class="menu" role="listbox">
          @if (loading()) {
            <li class="hint">Searching…</li>
          }
          @for (s of suggestions(); track s.name + s.latitude) {
            <li role="option" (mousedown)="pick($event, s)">{{ s.name }}</li>
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
        gap: 10px;
        padding: 12px 12px;
      }
      .dot {
        flex: 0 0 auto;
        width: 12px;
        height: 12px;
        border-radius: 50%;
      }
      .dot.origin {
        background: var(--accent);
      }
      .dot.dest {
        background: transparent;
        border: 3px solid var(--sev-severe);
      }
      /* F-006 stop rows: a numbered badge instead of the plain origin/destination dot. */
      .dot.stop {
        width: 16px;
        height: 16px;
        margin-left: -2px;
        background: var(--accent);
        color: var(--accent-contrast);
        display: grid;
        place-items: center;
        font-size: 10px;
        font-weight: 700;
        line-height: 1;
      }
      input {
        flex: 1;
        min-width: 0;
        border: none;
        background: transparent;
        color: var(--text);
        font: inherit;
        outline: none;
      }
      input::placeholder {
        color: var(--muted);
      }
      .clear {
        border: none;
        background: transparent;
        color: var(--muted);
        font-size: 20px;
        line-height: 1;
        cursor: pointer;
        padding: 0 2px;
      }
      .menu {
        position: absolute;
        z-index: 20;
        top: calc(100% - 2px);
        left: 34px;
        right: 8px;
        list-style: none;
        margin: 0;
        padding: 4px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.18);
        max-height: 260px;
        overflow-y: auto;
      }
      .menu li {
        padding: 9px 10px;
        border-radius: 8px;
        font-size: 14px;
        cursor: pointer;
      }
      .menu li[role='option']:hover {
        background: var(--surface-2);
      }
      .hint {
        color: var(--muted);
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
