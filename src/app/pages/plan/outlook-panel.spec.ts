import { TestBed } from '@angular/core/testing';
import type { OutlookResponse } from '@road-travel/sdk';

import { OutlookPanel } from './outlook-panel';
import { Plan } from './plan';

const outlook = (over: Partial<OutlookResponse> = {}): OutlookResponse => ({
  tier: 'outlook',
  travel_date: '2026-11-20',
  distance_meters: 320_000,
  duration_seconds: 14_400,
  route_coordinates: [],
  points: [
    {
      index: 0,
      latitude: 30,
      longitude: -97,
      distance_from_start_meters: 0,
      typical: {
        temp_high_c: 18,
        temp_low_c: 6,
        wet_day_prob: 0.33,
        snow_day_prob: 0.16,
        high_wind_prob: 0.25,
        extreme_heat_prob: 0.01,
        wind_kph_mean: 19,
        cell_latitude: 30.5,
        cell_longitude: -97.5,
      },
    },
  ],
  baseline: '1991-2020',
  source: 'ERA5',
  disclaimer: "This is what this stretch is usually like — history, not a forecast.",
  coverage: 'full',
  ...over,
});

function render(response: OutlookResponse): HTMLElement {
  const fixture = TestBed.createComponent(OutlookPanel);
  fixture.componentRef.setInput('outlook', response);
  fixture.componentRef.setInput('units', 'imperial');
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('Plan.tierFor', () => {
  const now = new Date('2026-09-12T12:00:00Z');

  it('draws the line at the forecast horizon', () => {
    const day = (n: number) => new Date(now.getTime() + n * 86_400_000);
    expect(Plan.tierFor(day(9), now)).toBe('forecast');
    expect(Plan.tierFor(day(10), now)).toBe('forecast');
    expect(Plan.tierFor(day(11), now)).toBe('outlook');
    expect(Plan.tierFor(day(40), now)).toBe('outlook');
  });

  it('compares by day, so an evening departure on the last day is still a forecast', () => {
    const evening = new Date(now.getTime() + 10 * 86_400_000);
    evening.setHours(18, 0, 0, 0);
    expect(Plan.tierFor(evening, now)).toBe('forecast');
  });

  it("sends the user's local calendar day", () => {
    // An instant would answer a late departure for the following day, and therefore for the wrong
    // time of year.
    const late = new Date(2026, 10, 20, 23, 30);
    expect(Plan.isoDay(late)).toBe('2026-11-20');
  });
});

describe('OutlookPanel', () => {
  it('states frequencies rather than percentages', () => {
    // "about 1 day in 3" is plannable; "33%" on a day nobody has forecast is a number pretending
    // to be a forecast.
    const text = render(outlook()).textContent ?? '';
    expect(text).toContain('Wet about 1 day in 3');
    expect(text).toContain('Snow about 1 day in 6');
    expect(text).toContain('High wind about 1 day in 4');
  });

  it('leaves out a negligible chance rather than listing it at zero', () => {
    expect(render(outlook()).textContent ?? '').not.toContain('Extreme heat');
  });

  it('always shows the disclaimer and the baseline', () => {
    const text = render(outlook()).textContent ?? '';
    expect(text).toContain('history, not a forecast');
    expect(text).toContain('1991-2020');
  });

  it('says it has no history rather than rendering an empty list', () => {
    // An empty list would read as "nothing to worry about" — the state every route is in until
    // the climate table is loaded.
    const text = render(outlook({ coverage: 'none', baseline: null, source: null,
      points: [{ index: 0, latitude: 30, longitude: -97, distance_from_start_meters: 0, typical: null }] })).textContent ?? '';
    expect(text).toContain('No history for this route yet');
    expect(text).toContain('history, not a forecast');
  });

  it('shows no severity vocabulary anywhere', () => {
    // The structural guarantee, on the client side: nothing in this surface may read as a forecast.
    const html = render(outlook()).innerHTML;
    for (const forbidden of ['severity', 'sev-clear', 'sev-caution', 'sev-severe']) {
      expect(html).not.toContain(forbidden);
    }
  });
});
