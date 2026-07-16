import { Component, ElementRef, effect, inject, input, output } from '@angular/core';
import type { PlanTripResponse } from '@road-travel/sdk';

import { SEVERITY_COLOR, type Severity, formatTemp, formatWind, weatherEmoji } from './severity';

/**
 * Scrollable space-time strip: one card per route sample, showing the forecast for the hour the
 * driver will actually be there (the core algorithm). Colored by per-sample severity, and two-way
 * selection-synced with the map — hover/click a card to highlight its dot on the map (and back).
 * Mirrors the iOS TimelineStripView.
 */
@Component({
  selector: 'app-timeline',
  template: `
    <div class="strip" role="list">
      @for (s of plan().samples; track s.index) {
        <div
          class="cell"
          role="listitem"
          tabindex="0"
          [attr.data-idx]="s.index"
          [class.sel]="s.index === selected()"
          [style.borderColor]="dot(s.weather?.severity)"
          (click)="selectedChange.emit(s.index)"
          (mouseenter)="selectedChange.emit(s.index)"
          (focus)="selectedChange.emit(s.index)"
        >
          <div class="mi">{{ mi(s.distance_from_start_meters) }} mi</div>
          <div class="eta">{{ time(s.eta) }}</div>
          @if (s.weather; as w) {
            <div class="cond-row">
              <span class="wx" [title]="w.condition_text">{{ emoji(w.condition_symbol, w.condition_text) }}</span>
              <span class="temp">{{ temp(w.temperature_c) }}</span>
            </div>
            <div class="cond" [title]="w.condition_text">{{ w.condition_text }}</div>
            <div class="meta">
              <span class="drop">💧 {{ precip(w.precipitation_chance) }}</span>
              <span>💨 {{ wind(w.wind_speed_kph) }}</span>
            </div>
          } @else {
            <div class="cond-row"><span class="temp muted">—</span></div>
            <div class="cond muted">no data</div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .strip {
        display: flex;
        gap: 10px;
        overflow-x: auto;
        overflow-y: hidden;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior-x: contain;
        padding: 2px 2px 12px;
        scroll-snap-type: x proximity;
      }
      .strip::-webkit-scrollbar {
        height: 8px;
      }
      .strip::-webkit-scrollbar-thumb {
        background: var(--border);
        border-radius: 999px;
      }
      .cell {
        flex: 0 0 auto;
        width: 116px;
        border: 2px solid var(--border);
        border-radius: 14px;
        padding: 10px 12px;
        background: var(--surface-2);
        scroll-snap-align: start;
        cursor: pointer;
        transition: box-shadow 0.12s ease, transform 0.12s ease;
        outline: none;
      }
      .cell.sel {
        box-shadow: 0 0 0 2px var(--accent);
        transform: translateY(-2px);
      }
      .mi {
        font-size: 11px;
        color: var(--muted);
        font-weight: 600;
      }
      .eta {
        font-weight: 600;
        font-size: 13px;
        margin-top: 2px;
      }
      .cond-row {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 4px;
      }
      .wx {
        font-size: 20px;
        line-height: 1;
      }
      .temp {
        font-size: 22px;
        font-weight: 700;
        color: var(--text);
      }
      .cond {
        font-size: 12px;
        color: var(--text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-top: 2px;
      }
      .meta {
        display: flex;
        gap: 8px;
        font-size: 11px;
        color: var(--muted);
        margin-top: 6px;
      }
      .muted {
        color: var(--muted);
      }
    `,
  ],
})
export class Timeline {
  readonly plan = input.required<PlanTripResponse>();
  readonly units = input<'imperial' | 'metric'>('imperial');
  /** Selected sample index, shared with the map (null = none). */
  readonly selected = input<number | null>(null);
  readonly selectedChange = output<number | null>();

  private readonly host = inject(ElementRef<HTMLElement>);

  constructor() {
    // When the selection changes (e.g. from a map-dot click), scroll the card into view — but only
    // if it's off-screen, so hovering a visible card doesn't yank the strip around.
    effect(() => {
      const idx = this.selected();
      if (idx == null) return;
      const root = this.host.nativeElement as HTMLElement;
      const strip = root.querySelector<HTMLElement>('.strip');
      const cell = root.querySelector<HTMLElement>(`[data-idx="${idx}"]`);
      if (!strip || !cell) return;
      const sr = strip.getBoundingClientRect();
      const cr = cell.getBoundingClientRect();
      if (cr.left < sr.left || cr.right > sr.right) {
        cell.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      }
    });
  }

  dot(sev?: Severity): string {
    return SEVERITY_COLOR[sev ?? 'clear'];
  }
  emoji(symbol?: string, text?: string): string {
    return weatherEmoji(symbol, text);
  }
  time(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  temp(c: number): string {
    return formatTemp(c, this.units());
  }
  wind(kph: number): string {
    return formatWind(kph, this.units());
  }
  precip(p: number): string {
    return `${Math.round(p * 100)}%`;
  }
  mi(m: number): string {
    return (m / 1609.344).toFixed(0);
  }
}
