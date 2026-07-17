import { Component, ElementRef, effect, inject, input, output } from '@angular/core';
import type { PlanTripResponse } from '@road-travel/sdk';

import { SEVERITY_COLOR, type Severity, formatTemp, formatWind, weatherEmoji } from './severity';
import { formatDwell } from './waypoints';

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
          [class.stop]="s.waypoint_index != null"
          [style.borderColor]="s.waypoint_index != null ? null : dot(s.weather?.severity)"
          (click)="selectedChange.emit(s.index)"
          (mouseenter)="selectedChange.emit(s.index)"
          (focus)="selectedChange.emit(s.index)"
        >
          @if (s.waypoint_index != null) {
            <!-- F-006 US-3: a stop is a first-class cell — name, ARRIVAL time, dwell, weather. -->
            <div class="stop-head">
              <span class="stop-num">{{ s.waypoint_index + 1 }}</span>
              <span class="stop-name" [title]="stopName(s.waypoint_index)">{{ short(stopName(s.waypoint_index)) }}</span>
            </div>
            <div class="eta">arrive {{ time(s.eta) }}</div>
            <div class="dwell">{{ dwell(s.dwell_seconds) }}</div>
          } @else {
            <div class="mi">{{ mi(s.distance_from_start_meters) }} mi</div>
            <div class="eta">{{ time(s.eta) }}</div>
          }
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
      /* F-006: stop cells read as first-class stops, distinct from milestone cells. */
      .cell.stop {
        border-color: var(--accent);
        background: var(--surface);
      }
      .stop-head {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
      }
      .stop-num {
        flex: 0 0 auto;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--accent);
        color: var(--accent-contrast);
        display: grid;
        place-items: center;
        font-size: 10px;
        font-weight: 700;
        line-height: 1;
      }
      .stop-name {
        font-size: 12px;
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .dwell {
        font-size: 11px;
        font-weight: 600;
        color: var(--accent);
        margin-top: 2px;
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
  /** The stop's display name from the plan's echoed waypoints (F-006). */
  stopName(waypointIndex: number): string {
    return this.plan().waypoints?.[waypointIndex]?.name ?? `Stop ${waypointIndex + 1}`;
  }
  short(name: string): string {
    return name.split(',')[0];
  }
  dwell(dwellSeconds?: number): string {
    return formatDwell(Math.round((dwellSeconds ?? 0) / 60));
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
