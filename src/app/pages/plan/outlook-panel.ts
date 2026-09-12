import { Component, computed, input } from '@angular/core';
import type { OutlookResponse } from '@road-travel/sdk';

import { IconComponent } from '../../ui/icon';

/**
 * Typical conditions for a date past the forecast horizon.
 *
 * **Deliberately a different kind of surface from the forecast timeline.** No severity colours, no
 * condition glyphs, no hour-by-hour cells — that vocabulary belongs to a forecast, and borrowing
 * any of it would invite a reader to treat a 30-year average as a prediction. Frequencies, muted
 * styling, and the server's disclaimer above the numbers rather than in a footnote.
 */
@Component({
  selector: 'app-outlook-panel',
  standalone: true,
  imports: [IconComponent],
  template: `
    <section class="outlook" aria-label="Typical conditions">
      <p class="disclaimer">
        <app-icon name="calendar" [size]="15" />
        <span>{{ outlook().disclaimer }}</span>
      </p>

      @if (hasHistory()) {
        <ul class="points">
          @for (p of withHistory(); track p.index) {
            <li class="point">
              <div class="head">
                <span class="mi">{{ mi(p.distance_from_start_meters) }} mi</span>
                <span class="temps">{{ temp(p.typical!.temp_high_c) }} / {{ temp(p.typical!.temp_low_c) }}</span>
              </div>
              <div class="chips">
                @for (chip of chips(p.typical!); track chip) {
                  <span class="chip">{{ chip }}</span>
                }
              </div>
            </li>
          }
        </ul>
      } @else {
        <!-- An empty list would read as "nothing to worry about". -->
        <p class="empty">
          <strong>No history for this route yet.</strong>
          We don't hold typical conditions for these roads. Check back nearer the day, when there's
          a real forecast.
        </p>
      }

      @if (outlook().baseline) {
        <p class="baseline">Based on {{ outlook().baseline }} averages · {{ outlook().source }}</p>
      }
    </section>
  `,
  styles: [
    `
      .outlook {
        display: grid;
        gap: 10px;
      }
      .disclaimer {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        margin: 0;
        padding: 10px 12px;
        border-radius: 12px;
        background: var(--well, #f9f4ed);
        color: var(--text-secondary, #82796a);
        font-size: 13px;
        font-weight: 500;
      }
      .points {
        display: grid;
        gap: 8px;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .point {
        padding: 10px 12px;
        border: 1px solid var(--border, #eee7db);
        border-radius: 12px;
        background: var(--surface, #fff);
      }
      .head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
      }
      .mi {
        font-size: 12px;
        font-weight: 700;
        color: var(--text-secondary, #82796a);
      }
      .temps {
        font-size: 13px;
        font-weight: 600;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 6px;
      }
      .chip {
        padding: 3px 8px;
        border-radius: 999px;
        background: var(--well, #f9f4ed);
        color: var(--text-secondary, #82796a);
        font-size: 11px;
        font-weight: 600;
      }
      .empty {
        margin: 0;
        padding: 16px;
        border-radius: 12px;
        background: var(--well, #f9f4ed);
        text-align: center;
        font-size: 13px;
        color: var(--text-secondary, #82796a);
      }
      .baseline {
        margin: 0;
        text-align: center;
        font-size: 11px;
        color: var(--text-tertiary, #a19786);
      }
    `,
  ],
})
export class OutlookPanel {
  readonly outlook = input.required<OutlookResponse>();
  readonly units = input<'imperial' | 'metric'>('imperial');

  readonly hasHistory = computed(() => this.outlook().coverage !== 'none');
  readonly withHistory = computed(() => this.outlook().points.filter((p) => p.typical));

  mi(meters: number): number {
    return Math.round(meters / 1609.344);
  }

  temp(celsius: number): string {
    return this.units() === 'metric'
      ? `${Math.round(celsius)}°C`
      : `${Math.round(celsius * 1.8 + 32)}°F`;
  }

  /**
   * Frequencies, not percentages: "about 1 day in 3" is something a driver can plan around, where
   * "33%" on a day nobody has forecast is a number pretending to be a forecast. Negligible chances
   * are left out entirely so the one that matters stands out.
   */
  chips(typical: NonNullable<OutlookResponse['points'][number]['typical']>): string[] {
    const out: string[] = [];
    const phrase = (p: number): string | null =>
      p >= 0.05 ? `about 1 day in ${Math.max(2, Math.round(1 / p))}` : null;

    const wet = phrase(typical.wet_day_prob);
    if (wet) out.push(`Wet ${wet}`);
    const snow = phrase(typical.snow_day_prob);
    if (snow) out.push(`Snow ${snow}`);
    // Wind earns its place whenever it is common: this audience tows, and crosswind is a safety
    // question rather than a comfort one.
    const wind = phrase(typical.high_wind_prob);
    if (wind) out.push(`High wind ${wind}`);
    const heat = phrase(typical.extreme_heat_prob);
    if (heat) out.push(`Extreme heat ${heat}`);
    return out.length ? out : ['Usually settled'];
  }
}
