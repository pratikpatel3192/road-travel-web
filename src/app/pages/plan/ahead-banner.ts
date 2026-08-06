import { Component, computed, input } from '@angular/core';
import type { PlanTripResponse } from '@road-travel/sdk';

import { IconComponent } from '../../ui/icon';
import { SEVERITY_LABEL, type Severity, formatTemp, formatWind } from './severity';

/**
 * A heads-up banner for the first notable (caution/severe) weather along the route — the planning
 * analogue of the iOS live "weather ahead" monitor (which uses the driver's GPS). Hidden when the
 * whole route is clear.
 */
@Component({
  selector: 'app-ahead-banner',
  imports: [IconComponent],
  template: `
    @if (ahead(); as a) {
      <div class="banner" [class.severe]="a.severity === 'severe'" role="status">
        <span class="ic" aria-hidden="true"><app-icon name="triangle-alert" [size]="20" /></span>
        <div class="body">
          <div class="head">{{ label(a.severity) }} weather ~{{ a.miles }} mi in</div>
          <div class="detail">
            {{ a.condition }} · {{ temp(a.tempC) }} · {{ precip(a.precip) }} precip · {{ wind(a.windKph) }} wind
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .banner {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 11px 14px;
        border-radius: var(--radius-md);
        background: var(--sev-caution);
        color: #ffffff;
        box-shadow: var(--shadow-md);
      }
      .banner.severe {
        background: var(--sev-severe);
      }
      .ic {
        flex: 0 0 auto;
        display: inline-flex;
        line-height: 0;
      }
      .head {
        font-weight: 700;
        font-size: 14px;
      }
      .detail {
        font-size: 12px;
        opacity: 0.95;
        margin-top: 1px;
      }
      /* Night: the severity fills lighten, so the ink flips dark for contrast. */
      :host-context([data-theme='dark']) .banner {
        color: var(--neutral-900);
      }
      @media (prefers-color-scheme: dark) {
        :host-context(:root:not([data-theme])) .banner {
          color: var(--neutral-900);
        }
      }
    `,
  ],
})
export class AheadBanner {
  readonly plan = input.required<PlanTripResponse>();
  readonly units = input<'imperial' | 'metric'>('imperial');

  /** The first sample whose weather is caution-or-worse, distilled for display (null if all clear). */
  readonly ahead = computed(() => {
    const sample = this.plan().samples.find(
      (s) => s.weather && (s.weather.severity === 'caution' || s.weather.severity === 'severe'),
    );
    const w = sample?.weather;
    if (!sample || !w) return null;
    return {
      severity: w.severity as Severity,
      miles: Math.round(sample.distance_from_start_meters / 1609.344),
      condition: w.condition_text,
      tempC: w.temperature_c,
      precip: w.precipitation_chance,
      windKph: w.wind_speed_kph,
    };
  });

  label(s: Severity): string {
    return SEVERITY_LABEL[s];
  }
  temp(c: number): string {
    return formatTemp(c, this.units());
  }
  wind(k: number): string {
    return formatWind(k, this.units());
  }
  precip(p: number): string {
    return `${Math.round(p * 100)}%`;
  }
}
