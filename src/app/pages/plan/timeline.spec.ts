import { TestBed } from '@angular/core/testing';
import type { PlanTripResponse, RouteSampleModel, WeatherSnapshotModel } from '@road-travel/sdk';

import { SEVERITY_COLOR, SEVERITY_LEVELS, UNKNOWN_COLOR, type Severity } from './severity';
import { Timeline } from './timeline';

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

/** A minimal multi-stop plan: origin sample, one stop-marked sample (45 min dwell), destination. */
const plan = (): PlanTripResponse => ({
  origin: { name: 'San Francisco, CA', latitude: 37.7749, longitude: -122.4194 },
  destination: { name: 'Los Angeles, CA', latitude: 34.0522, longitude: -118.2437 },
  departure_at: '2026-07-16T15:00:00Z',
  arrival_at: '2026-07-16T22:15:00Z',
  distance_meters: 613_000,
  duration_seconds: 6 * 3600,
  waypoints: [
    { name: 'Harris Ranch, CA', latitude: 36.2519, longitude: -120.2378, dwell_minutes: 45 },
  ],
  total_dwell_seconds: 45 * 60,
  worst_severity: 'clear',
  route_coordinates: [],
  samples: [
    sample(0),
    sample(1, { waypoint_index: 0, dwell_seconds: 45 * 60 }),
    sample(2),
  ],
  segments: [],
  meta: { sample_count: 3, segment_count: 0, route_point_count: 0, provider_mode: 'mock' },
});

/** F-006 US-3: a stop-marked sample renders as a first-class stop cell on the timeline. */
describe('Timeline stop cells (F-006)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Timeline] }).compileComponents();
  });

  function render(p: PlanTripResponse = plan()) {
    const fixture = TestBed.createComponent(Timeline);
    fixture.componentRef.setInput('plan', p);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the stop sample as a distinct cell with name, arrival, dwell AND weather', () => {
    const el = render().nativeElement as HTMLElement;
    const cells = el.querySelectorAll<HTMLElement>('.cell');
    expect(cells.length).toBe(3);

    const stopCell = el.querySelector<HTMLElement>('.cell.stop')!;
    expect(stopCell).toBeTruthy();
    expect(stopCell.getAttribute('data-idx')).toBe('1');
    expect(stopCell.querySelector('.stop-num')?.textContent?.trim()).toBe('1'); // 1-based stop number
    expect(stopCell.querySelector('.stop-name')?.textContent).toContain('Harris Ranch');
    expect(stopCell.querySelector('.eta')?.textContent).toContain('arrive');
    expect(stopCell.querySelector('.dwell')?.textContent).toContain('45 min stop');
    // Weather-at-arrival renders like any other cell (WeatherKit-backed forecast).
    expect(stopCell.querySelector('.cond')?.textContent).toContain('Sunny');

    // Milestone cells are untouched: distance + time, no stop chrome.
    const first = cells[0];
    expect(first.classList.contains('stop')).toBe(false);
    expect(first.querySelector('.mi')?.textContent).toContain('mi');
    expect(first.querySelector('.dwell')).toBeNull();
  });

  it('labels a zero-dwell stop as "Pass through"', () => {
    const p = plan();
    p.samples[1] = sample(1, { waypoint_index: 0, dwell_seconds: 0 });
    const el = render(p).nativeElement as HTMLElement;
    expect(el.querySelector('.cell.stop .dwell')?.textContent).toContain('Pass through');
  });

  it('keeps the click → selection sync for stop cells (map/timeline two-way sync)', () => {
    const fixture = render();
    let selected: number | null = null;
    fixture.componentInstance.selectedChange.subscribe((i) => (selected = i));
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.cell.stop')!.click();
    expect(selected).toBe(1);
  });
});

/**
 * The hazard tint is the timeline's whole at-a-glance signal. It used to be an enumeration —
 * `sev === 'caution' || sev === 'severe'` — which meant the two levels added ABOVE caution both
 * came out untinted, so the worst weather on a route drew the calmest cell on the strip.
 */
describe('Timeline — the hazard tint across the five-level scale', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Timeline] }).compileComponents();
  });

  const cellFor = (severity: Severity): HTMLElement => {
    const p = plan();
    p.samples = [sample(0, { weather: weather({ severity }) })];
    const fixture = TestBed.createComponent(Timeline);
    fixture.componentRef.setInput('plan', p);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.cell')!;
  };

  it.each([
    ['clear', false],
    ['caution', true],
    ['high', true],
    ['severe', true],
    ['extreme', true],
  ] as const)('tints a %s milestone: %s', (severity, tinted) => {
    expect(cellFor(severity).classList.contains('hazard')).toBe(tinted);
  });

  it.each(SEVERITY_LEVELS)('colours the %s dot with its own swatch', (severity) => {
    const fixture = TestBed.createComponent(Timeline);
    expect(fixture.componentInstance.dot(severity)).toBe(SEVERITY_COLOR[severity]);
  });

  it('gives a milestone with no weather the unknown grey, not the sage of clear', () => {
    const fixture = TestBed.createComponent(Timeline);
    expect(fixture.componentInstance.dot(undefined)).toBe(UNKNOWN_COLOR);
    expect(fixture.componentInstance.dot(undefined)).not.toBe(SEVERITY_COLOR.clear);
  });
});

describe('Timeline — past the forecast horizon', () => {
  it('says there is no forecast yet instead of leaving the cell blank', () => {
    const beyond = plan();
    beyond.samples = [
      sample(0),
      sample(1, { weather: null, beyond_forecast: true }),
    ];
    const fixture = TestBed.createComponent(Timeline);
    fixture.componentRef.setInput('plan', beyond);
    fixture.componentRef.setInput('units', 'imperial');
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No forecast yet');
  });

  it('leaves a failed fetch blank rather than claiming the forecast does not exist', () => {
    // Two different silences: "we could not get it" and "nobody has it yet". Only the second is
    // something a driver can plan around, and only it earns the sentence.
    const failed = plan();
    failed.samples = [sample(0), sample(1, { weather: null, beyond_forecast: false })];
    const fixture = TestBed.createComponent(Timeline);
    fixture.componentRef.setInput('plan', failed);
    fixture.componentRef.setInput('units', 'imperial');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent ?? '').not.toContain('No forecast yet');
  });
});
