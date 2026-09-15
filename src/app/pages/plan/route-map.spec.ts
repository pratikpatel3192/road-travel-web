import { TestBed } from '@angular/core/testing';
import type { PlanTripResponse, RouteSampleModel, WeatherSnapshotModel } from '@road-travel/sdk';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FORECAST_HORIZON_DAYS } from '../../core/forecast-horizon';
import { RouteMap, mapWeatherNotice, pinKind } from './route-map';

const weather = (over: Partial<WeatherSnapshotModel> = {}): WeatherSnapshotModel => ({
  forecast_date: '2026-07-16T16:00:00Z',
  temperature_c: 20,
  condition_symbol: 'sun.max.fill',
  condition_text: 'Sunny',
  precipitation_chance: 0.1,
  wind_speed_kph: 12,
  severity: 'clear',
  ...over,
});

const sample = (index: number, over: Partial<RouteSampleModel> = {}): RouteSampleModel => ({
  index,
  latitude: 36 + index * 0.5,
  longitude: -120 + index * 0.5,
  distance_from_start_meters: index * 40_000,
  eta: `2026-07-16T1${index}:30:00Z`,
  weather: weather(),
  leg_index: 0,
  waypoint_index: null,
  dwell_seconds: 0,
  ...over,
});

const past = (index: number, over: Partial<RouteSampleModel> = {}) =>
  sample(index, { weather: null, beyond_forecast: true, ...over });

const plan = (samples: RouteSampleModel[]): PlanTripResponse => ({
  origin: { name: 'Albuquerque, NM', latitude: 35.08, longitude: -106.65 },
  destination: { name: 'Phoenix, AZ', latitude: 33.45, longitude: -112.07 },
  departure_at: '2026-07-16T15:00:00Z',
  arrival_at: '2026-07-16T22:00:00Z',
  distance_meters: 600_000,
  duration_seconds: 6 * 3600,
  waypoints: [{ name: 'Flagstaff, AZ', latitude: 35.2, longitude: -111.65, dwell_minutes: 30 }],
  total_dwell_seconds: 30 * 60,
  worst_severity: 'clear',
  route_coordinates: [],
  samples,
  segments: [
    {
      severity: null,
      coordinates: [
        { latitude: 36, longitude: -120 },
        { latitude: 37.5, longitude: -118.5 },
      ],
    },
  ],
  meta: { sample_count: samples.length, segment_count: 1, route_point_count: 2, provider_mode: 'mock' },
});

const BEYOND_DAY_3 = `Day 3 is past the ${FORECAST_HORIZON_DAYS}-day forecast — we'll have it closer to the day.`;

/**
 * What the map draws for a route, or part of one, that nobody has forecast.
 *
 * The bug this pins: a day past the horizon drew a `.wx-pin` at every sample anyway — a dark pill
 * with only the thermometer fallback glyph and no temperature — over a grey line, with nothing to
 * say why. Users asked whether the icons were "expected" and why the route was grey.
 *
 * Leaflet does render under the unit-test DOM (markers are plain divIcon HTML), so these assert on
 * the real marker DOM rather than on a helper alone.
 */
describe('RouteMap — samples with no forecast', () => {
  beforeAll(() => {
    // Leaflet itself is happy here; the component's refit observer is the only missing browser API.
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
      observe(): void {}
      disconnect(): void {}
    };
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RouteMap] }).compileComponents();
  });

  async function render(p: PlanTripResponse | null, inputs: { day?: number | null; dayBeyondForecast?: boolean } = {}) {
    const fixture = TestBed.createComponent(RouteMap);
    fixture.componentRef.setInput('plan', p);
    if (inputs.day !== undefined) fixture.componentRef.setInput('day', inputs.day);
    if (inputs.dayBeyondForecast !== undefined) fixture.componentRef.setInput('dayBeyondForecast', inputs.dayBeyondForecast);
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0)); // render() is deferred a tick
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('draws no weather pill for a sample with null weather, but still draws the stop pin', async () => {
    const el = await render(plan([past(0), past(1, { waypoint_index: 0 }), past(2)]), { day: 3 });
    expect(el.querySelectorAll('.wx-pin').length).toBe(0);
    expect(el.querySelectorAll('.rt-stop-pin').length).toBe(1);
    expect(el.querySelector('.rt-stop-pin')?.textContent).toBe('1');
    // And specifically not the placeholder glyph the empty pill used to carry.
    expect(el.innerHTML).not.toContain('M14 4v10.54');
  });

  it('keeps the pills for samples that DO have weather, and only those', async () => {
    const el = await render(plan([sample(0), sample(1, { weather: null }), sample(2, { weather: weather({ temperature_c: 30 }) })]));
    const pins = [...el.querySelectorAll<HTMLElement>('.wx-pin')];
    expect(pins.length).toBe(2);
    expect(pins.map((p) => p.textContent?.trim())).toEqual(['68°', '86°']);
  });

  it('dashes the no-forecast stretch of the line so it reads as a state, not a failed layer', async () => {
    const el = await render(plan([past(0), past(1)]), { day: 3 });
    const line = el.querySelector('path.rt-sev-unknown');
    expect(line).toBeTruthy();
    expect(line?.getAttribute('stroke-dasharray')).toBeTruthy();
  });

  it('says on the map that a day past the horizon has no forecast yet', async () => {
    const el = await render(plan([past(0), past(1, { waypoint_index: 0 }), past(2)]), { day: 3 });
    const notice = el.querySelector<HTMLElement>('.wx-notice');
    expect(notice?.textContent?.trim()).toBe(BEYOND_DAY_3);
    expect(notice?.classList).toContain('prominent');
  });

  it('says the same when the day past the horizon comes back with no plan at all', async () => {
    const el = await render(null, { day: 3, dayBeyondForecast: true });
    expect(el.querySelector('.wx-notice')?.textContent?.trim()).toBe(BEYOND_DAY_3);
  });

  it('shows a smaller notice, and no invented pills, when a provider fails for part of the route', async () => {
    const el = await render(plan([sample(0), sample(1, { weather: null }), sample(2)]), { day: 2 });
    const notice = el.querySelector<HTMLElement>('.wx-notice');
    expect(notice?.textContent?.trim()).toBe("Weather isn't available for part of this route.");
    expect(notice?.classList).not.toContain('prominent');
    expect(el.querySelectorAll('.wx-pin').length).toBe(2);
  });

  it('shows no notice when every sample has weather', async () => {
    const el = await render(plan([sample(0), sample(1), sample(2)]), { day: 2 });
    expect(el.querySelector('.wx-notice')).toBeNull();
  });
});

describe('pinKind', () => {
  it('is a stop for a stop sample whether or not it has weather', () => {
    expect(pinKind({ waypoint_index: 0, weather: null })).toBe('stop');
    expect(pinKind({ waypoint_index: 0, weather: weather() })).toBe('stop');
  });

  it('is a weather pill only when there is weather, and nothing otherwise', () => {
    expect(pinKind({ waypoint_index: null, weather: weather() })).toBe('weather');
    expect(pinKind({ waypoint_index: null, weather: null })).toBeNull();
    expect(pinKind({ waypoint_index: undefined, weather: undefined })).toBeNull();
  });
});

describe('mapWeatherNotice', () => {
  it('names the day and quotes the horizon constant for a day past the forecast', () => {
    expect(mapWeatherNotice(plan([past(0), past(1)]), 3)).toEqual({ kind: 'beyond', prominent: true, text: BEYOND_DAY_3 });
    expect(BEYOND_DAY_3).toContain(`${FORECAST_HORIZON_DAYS}-day`);
  });

  it('says "This trip" for a one-day trip', () => {
    expect(mapWeatherNotice(plan([past(0), past(1)]), null)?.text).toBe(
      `This trip is past the ${FORECAST_HORIZON_DAYS}-day forecast — we'll have it closer to the day.`,
    );
  });

  it('never blames the horizon for a sample that failed INSIDE it', () => {
    // Every sample missing, but one of them is a failure, not the calendar: no "closer to the day".
    const n = mapWeatherNotice(plan([past(0), sample(1, { weather: null, beyond_forecast: false })]), 3);
    expect(n).toEqual({ kind: 'unavailable', prominent: true, text: "Weather isn't available for this route." });
  });

  it('notes, quietly, a day that runs off the end of the forecast part-way', () => {
    expect(mapWeatherNotice(plan([sample(0), past(1)]), 10)).toEqual({
      kind: 'partial-beyond',
      prominent: false,
      text: `Part of day 10 is past the ${FORECAST_HORIZON_DAYS}-day forecast.`,
    });
  });

  it('is null with nothing missing, and null for no plan unless the day is past the horizon', () => {
    expect(mapWeatherNotice(plan([sample(0), sample(1)]), 1)).toBeNull();
    expect(mapWeatherNotice(null, 2)).toBeNull();
    expect(mapWeatherNotice(null, 2, true)?.kind).toBe('beyond');
  });
});

/**
 * How a traveller zooms. On desktop the planner's trip panel floats over the left of the map and
 * covered Leaflet's default top-left zoom buttons completely, while wheel zoom was switched off —
 * so a desktop user had no way to zoom the map at all.
 */
describe('RouteMap — zoom controls', () => {
  beforeAll(() => {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
      observe(): void {}
      disconnect(): void {}
    };
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RouteMap] }).compileComponents();
  });

  async function mount(wheelZoom?: boolean) {
    const fixture = TestBed.createComponent(RouteMap);
    if (wheelZoom !== undefined) fixture.componentRef.setInput('wheelZoom', wheelZoom);
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0)); // the map is created a tick after the first render
    fixture.detectChanges();
    const map = () => (fixture.componentInstance as unknown as { map: { scrollWheelZoom: { enabled(): boolean } } }).map;
    return { fixture, el: fixture.nativeElement as HTMLElement, wheel: () => map().scrollWheelZoom.enabled() };
  }

  it('puts the zoom buttons in the top-right corner, never the top-left the trip panel covers', async () => {
    const { el } = await mount();
    expect(el.querySelectorAll('.leaflet-control-zoom').length).toBe(1);
    expect(el.querySelector('.leaflet-top.leaflet-right .leaflet-control-zoom')).toBeTruthy();
    expect(el.querySelector('.leaflet-top.leaflet-left .leaflet-control-zoom')).toBeNull();
    expect(el.querySelector('.leaflet-control-zoom-in')).toBeTruthy();
    expect(el.querySelector('.leaflet-control-zoom-out')).toBeTruthy();
  });

  it('leaves the wheel to scroll the page unless the host says the map is a full-height pane', async () => {
    const { fixture, wheel } = await mount();
    expect(wheel()).toBe(false);
    fixture.componentRef.setInput('wheelZoom', true);
    fixture.detectChanges();
    expect(wheel()).toBe(true);
    fixture.componentRef.setInput('wheelZoom', false);
    fixture.detectChanges();
    expect(wheel()).toBe(false);
  });

  it('creates the map with wheel zoom already on when the host asks from the start', async () => {
    const { wheel } = await mount(true);
    expect(wheel()).toBe(true);
  });

  it('zooms on the wheel while expanded full-screen, and stops again on collapse', async () => {
    const { fixture, wheel } = await mount(false);
    fixture.componentInstance.toggleExpand();
    fixture.detectChanges();
    expect(wheel()).toBe(true);
    fixture.componentInstance.onEscape();
    fixture.detectChanges();
    expect(wheel()).toBe(false);
  });
});
