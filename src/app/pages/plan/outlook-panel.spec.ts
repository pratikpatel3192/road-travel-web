import { TestBed } from '@angular/core/testing';
import type { OutlookResponse } from '@road-travel/sdk';

import { OutlookPanel } from './outlook-panel';
import { Plan } from './plan';
import { SEVERITY_COLOR, SEVERITY_LEVELS } from './severity';

/**
 * The severity vocabulary this panel must never speak, derived from the scale itself rather than
 * listed by hand. A hand-written list only guards the levels that existed when it was written —
 * when the scale went from three levels to five, a list naming clear/caution/severe would have
 * gone on passing while `sev-high` and `sev-extreme` leaked straight through it.
 */
const SEVERITY_VOCABULARY = [
  'severity',
  ...SEVERITY_LEVELS.map((level) => `sev-${level}`),
  ...Object.values(SEVERITY_COLOR),
];

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
  disclaimer: 'This is what this stretch is usually like — history, not a forecast.',
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
    const text =
      render(
        outlook({
          coverage: 'none',
          baseline: null,
          source: null,
          points: [
            {
              index: 0,
              latitude: 30,
              longitude: -97,
              distance_from_start_meters: 0,
              typical: null,
            },
          ],
        }),
      ).textContent ?? '';
    expect(text).toContain('No history for this route yet');
    expect(text).toContain('history, not a forecast');
  });

  it("shows the server's risk sentences verbatim", () => {
    // Verbatim on purpose: a chip this panel composed itself from `kind` is a chip that can get
    // the tense wrong, and "expect snow" for a climatology leg undoes the whole feature.
    const note =
      'Snow is part of the record on this stretch in late October — roughly one day in 6.';
    const text =
      render(outlook({ risks: [{ kind: 'snow', probability: 0.16, note }] })).textContent ?? '';
    expect(text).toContain(note);
  });

  it('shows the better-window suggestion when the server sent one', () => {
    const note = 'Historically, early November is a kinder week on this stretch than late October.';
    const text =
      render(
        outlook({
          better_window: { travel_date: '2026-11-03', planned_score: 0.4, score: 0.1, note },
        }),
      ).textContent ?? '';
    expect(text).toContain(note);
  });

  it('draws a risk in the same muted treatment as everything else here', () => {
    // A risk in a warning colour would be the forecast severity vocabulary borrowed for a 30-year
    // average — the one thing this panel must never do, however alarming the sentence is.
    const html = render(
      outlook({ risks: [{ kind: 'snow', probability: 0.4, note: 'Snow is part of the record.' }] }),
    ).innerHTML;
    for (const forbidden of ['sev-', '#b3261e', ...SEVERITY_VOCABULARY]) {
      expect(html).not.toContain(forbidden);
    }
  });

  it('renders nothing when there are no risks rather than an all-clear', () => {
    // Empty means nothing stood out, NOT that the route is safe — and it is also what an
    // unloaded climate table returns for every route on earth.
    const element = render(outlook({ risks: [], better_window: null }));
    expect(element.querySelector('.risk')).toBeNull();
    expect(element.querySelector('.window')).toBeNull();
    expect((element.textContent ?? '').toLowerCase()).not.toContain('all clear');
  });

  it('shows no severity vocabulary anywhere', () => {
    // The structural guarantee, on the client side: nothing in this surface may read as a forecast.
    const html = render(outlook()).innerHTML;
    for (const forbidden of SEVERITY_VOCABULARY) {
      expect(html).not.toContain(forbidden);
    }
  });
});
