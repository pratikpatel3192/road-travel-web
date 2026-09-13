import { TestBed } from '@angular/core/testing';
import type { PlanTripResponse, RouteSampleModel, WeatherSnapshotModel } from '@road-travel/sdk';

import { AheadBanner } from './ahead-banner';
import { SEVERITY_LEVELS, type Severity } from './severity';

const weather = (over: Partial<WeatherSnapshotModel> = {}): WeatherSnapshotModel => ({
  forecast_date: '2026-07-16T16:00:00Z',
  temperature_c: 20,
  condition_symbol: 'cloud.rain.fill',
  condition_text: 'Rain',
  precipitation_chance: 0.6,
  wind_speed_kph: 24,
  severity: 'clear',
  ...over,
});

const sample = (index: number, over: Partial<RouteSampleModel> = {}): RouteSampleModel => ({
  index,
  latitude: 36 + index,
  longitude: -120,
  distance_from_start_meters: index * 40_000,
  eta: `2026-07-16T1${index}:30:00Z`,
  weather: weather(),
  leg_index: 0,
  waypoint_index: null,
  dwell_seconds: 0,
  ...over,
});

const plan = (samples: RouteSampleModel[]): PlanTripResponse => ({
  origin: { name: 'San Francisco, CA', latitude: 37.7749, longitude: -122.4194 },
  destination: { name: 'Los Angeles, CA', latitude: 34.0522, longitude: -118.2437 },
  departure_at: '2026-07-16T15:00:00Z',
  arrival_at: '2026-07-16T22:15:00Z',
  distance_meters: 613_000,
  duration_seconds: 6 * 3600,
  waypoints: [],
  total_dwell_seconds: 0,
  worst_severity: 'clear',
  route_coordinates: [],
  samples,
  segments: [],
  meta: {
    sample_count: samples.length,
    segment_count: 0,
    route_point_count: 0,
    provider_mode: 'mock',
  },
});

function render(samples: RouteSampleModel[]) {
  const fixture = TestBed.createComponent(AheadBanner);
  fixture.componentRef.setInput('plan', plan(samples));
  fixture.detectChanges();
  return fixture;
}

/**
 * The banner's sample filter used to enumerate the levels it cared about
 * (`severity === 'caution' || severity === 'severe'`). That reads as "caution or worse" and is not:
 * when the scale grew, `high` and `extreme` matched neither arm, so the two worst things that can
 * happen on a route were the only two that raised no banner at all.
 */
describe('AheadBanner — which samples raise the banner', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AheadBanner] }).compileComponents();
  });

  it.each(SEVERITY_LEVELS.filter((level) => level !== 'clear'))(
    'raises the banner for a %s sample',
    (severity) => {
      const fixture = render([sample(0), sample(1, { weather: weather({ severity }) })]);
      expect(fixture.componentInstance.ahead()?.severity).toBe(severity);
      expect((fixture.nativeElement as HTMLElement).querySelector('.banner')).toBeTruthy();
    },
  );

  it('stays hidden when every sample is clear', () => {
    const fixture = render([sample(0), sample(1)]);
    expect(fixture.componentInstance.ahead()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.banner')).toBeNull();
  });

  it('reports the FIRST notable sample, not the worst one', () => {
    // "~40 mi in" has to mean the first thing you hit, or the distance is a lie.
    const fixture = render([
      sample(0),
      sample(1, { weather: weather({ severity: 'caution' }) }),
      sample(2, { weather: weather({ severity: 'extreme' }) }),
    ]);
    expect(fixture.componentInstance.ahead()?.severity).toBe('caution');
    expect(fixture.componentInstance.ahead()?.miles).toBe(25); // 40 km
  });

  it('ignores samples that have no weather at all', () => {
    const fixture = render([sample(0, { weather: null }), sample(1, { weather: null })]);
    expect(fixture.componentInstance.ahead()).toBeNull();
  });

  it('treats a severity this build does not recognise as worth raising', () => {
    // Erring the other way would hide a warning the server went out of its way to send.
    const fixture = render([
      sample(0),
      sample(1, {
        weather: weather({ severity: 'cataclysmic' as WeatherSnapshotModel['severity'] }),
      }),
    ]);
    expect(fixture.componentInstance.ahead()?.severity).toBe('caution');
  });
});

describe('AheadBanner — how loudly it says it', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AheadBanner] }).compileComponents();
  });

  it.each(['caution', 'high', 'severe', 'extreme'] as const)(
    'carries the sev-%s class and the level word',
    (severity: Severity) => {
      const el = render([sample(0, { weather: weather({ severity }) })])
        .nativeElement as HTMLElement;
      const banner = el.querySelector<HTMLElement>('.banner')!;
      // A class per level: every level above caution used to share one orange fill, so the banner
      // looked identical whether the advice was "slow down" or "do not drive into this".
      expect(banner.classList.contains(`sev-${severity}`)).toBe(true);
      expect(banner.querySelector('.head')?.textContent?.toLowerCase()).toContain(severity);
    },
  );
});
