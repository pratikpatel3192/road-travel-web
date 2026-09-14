import { TestBed } from '@angular/core/testing';
import type {
  BriefingFactsModel,
  ItineraryBriefingResponse,
  ItineraryDayFactsModel,
  ItineraryRollupModel,
} from '@road-travel/sdk';

import { SEVERITY_COLOR, UNKNOWN_COLOR, UNKNOWN_LABEL } from './severity';
import { TripBriefingCard } from './trip-briefing-card';

/** A hex as the DOM spells it back — a second hand-written spelling of a colour is a second source. */
function asRendered(hex: string): string {
  const probe = document.createElement('span');
  probe.style.background = hex;
  return probe.style.background;
}

const facts = (over: Partial<BriefingFactsModel> = {}): BriefingFactsModel => ({
  origin_name: 'Dallas, TX',
  destination_name: 'Albuquerque, NM',
  departure_at: '2026-10-01T13:00:00Z',
  arrival_at: '2026-10-01T22:00:00Z',
  total_distance_meters: 1_046_000, // 650 mi
  duration_seconds: 9 * 3600,
  sample_count: 12,
  samples_with_weather: 12,
  overall_severity: 'clear',
  hazards: [],
  ...over,
});

const day = (
  ordinal: number,
  over: Partial<ItineraryDayFactsModel> = {},
): ItineraryDayFactsModel => ({
  ordinal,
  origin_name: 'Dallas, TX',
  destination_name: 'Albuquerque, NM',
  travel_date: '2026-10-01',
  nights_at_destination: 0,
  beyond_forecast: false,
  error: null,
  facts: null,
  severity: null,
  ...over,
});

const rollup = (over: Partial<ItineraryRollupModel> = {}): ItineraryRollupModel => ({
  total_days: 4,
  total_nights: 3,
  total_distance_meters: 2_092_000,
  overall_severity: 'clear',
  worst_day_ordinal: 0,
  days_with_forecast: 2,
  days_beyond_forecast: 0,
  days_failed: 0,
  clear_day_ordinals: [0, 1],
  rough_day_ordinals: [],
  partly_unknown: false,
  ...over,
});

const briefing = (over: Partial<ItineraryBriefingResponse> = {}): ItineraryBriefingResponse => ({
  text: '2 drives across 4 days, 3 nights on the way. Both days look clear.',
  model: 'template',
  generated_at: '2026-09-20T10:00:00Z',
  days: [
    day(0, { facts: facts(), severity: 'clear' }),
    day(1, {
      origin_name: 'Albuquerque, NM',
      destination_name: 'Los Angeles, CA',
      travel_date: '2026-10-04',
      facts: facts({ origin_name: 'Albuquerque, NM', destination_name: 'Los Angeles, CA' }),
      severity: 'clear',
    }),
  ],
  rollup: rollup(),
  ...over,
});

/**
 * The whole-trip briefing card. These are the honesty rules the endpoint was built to enforce, and
 * this card is the last place they can be quietly undone — the day rows are where a trip that has
 * barely been looked at could be drawn as a calm one.
 */
describe('TripBriefingCard — a day nobody has forecast is not a clear day', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TripBriefingCard] }).compileComponents();
  });

  function render(response: ItineraryBriefingResponse, selectedDay: number | null = 0) {
    const fixture = TestBed.createComponent(TripBriefingCard);
    fixture.componentRef.setInput('briefing', response);
    fixture.componentRef.setInput('selectedDay', selectedDay);
    fixture.detectChanges();
    return fixture;
  }

  const rows = (fixture: { nativeElement: unknown }) =>
    (fixture.nativeElement as HTMLElement).querySelectorAll('.day');

  it('draws a day past the horizon grey and unknown, never as the calm end of the scale', () => {
    const fixture = render(
      briefing({
        days: [day(0, { facts: facts(), severity: 'clear' }), day(1, { beyond_forecast: true })],
        rollup: rollup({ days_with_forecast: 1, days_beyond_forecast: 1, partly_unknown: true }),
      }),
    );
    const unforecast = rows(fixture)[1];
    expect(unforecast.querySelector('.sev-label')?.textContent?.trim()).toBe(UNKNOWN_LABEL);
    expect(unforecast.querySelector<HTMLElement>('.sev')?.style.background).toBe(
      asRendered(UNKNOWN_COLOR),
    );
    // Not the sage of `clear`, and not the word either.
    expect(unforecast.querySelector<HTMLElement>('.sev')?.style.background).not.toBe(
      asRendered(SEVERITY_COLOR.clear),
    );
    expect(unforecast.textContent).not.toContain('Clear');
    expect(unforecast.textContent).toContain('closer to the day');
  });

  it('still refuses a severity that arrives beside a reason there cannot be one', () => {
    // A server that sent both would be wrong, and the failure mode is the worst one available: a
    // confident green dot on a day nobody has looked at. `severity != null` is not the test.
    const fixture = render(
      briefing({
        days: [day(0, { beyond_forecast: true, severity: 'clear' })],
        rollup: rollup({ days_with_forecast: 0, days_beyond_forecast: 1, partly_unknown: true }),
      }),
    );
    expect(rows(fixture)[0].querySelector('.sev-label')?.textContent?.trim()).toBe(UNKNOWN_LABEL);
    // The same guard on the other reason: a failed route with a severity beside it is still a day
    // nobody has a reading for.
    expect(
      fixture.componentInstance.forecast({
        beyond_forecast: false,
        error: 'Route exceeds the supported length.',
        severity: 'clear',
      }),
    ).toBeNull();
  });

  it("says one day's route failed, in its own words, without calling it a forecast gap", () => {
    const fixture = render(
      briefing({
        days: [
          day(0, { facts: facts(), severity: 'clear' }),
          day(1, { error: 'Route exceeds the supported length.' }),
        ],
        rollup: rollup({ days_with_forecast: 1, days_failed: 1, partly_unknown: true }),
      }),
    );
    const failed = rows(fixture)[1];
    expect(failed.querySelector('.sev-label')?.textContent?.trim()).toBe(UNKNOWN_LABEL);
    expect(failed.textContent).toContain('Route exceeds the supported length.');
    expect(failed.textContent).toContain('The other days are unaffected');
    // The two reasons are different facts and must not borrow each other's sentence.
    expect(failed.textContent).not.toContain('closer to the day');
    // ...and the day that did arrive keeps its forecast.
    expect(rows(fixture)[0].querySelector('.sev-label')?.textContent?.trim()).toBe('Clear');
  });

  it('degrades a severity level this build predates to caution, not to unknown', () => {
    // The opposite failure from the one above: an unrecognised WORD means the scale grew, and it
    // grew at the bad end. Grey would read as "nobody knows", which is not what happened. Passed as
    // the string the wire actually carries — no cast, because the reader takes a string on purpose.
    const fixture = render(briefing());
    expect(
      fixture.componentInstance.forecast({
        beyond_forecast: false,
        error: null,
        severity: 'cataclysmic',
      }),
    ).toBe('caution');
  });

  it('counts how much of the trip has been looked at, split by why', () => {
    const fixture = render(
      briefing({
        days: [
          day(0, { facts: facts(), severity: 'caution' }),
          day(1, { beyond_forecast: true }),
          day(2, { beyond_forecast: true }),
          day(3, { error: 'No route.' }),
        ],
        rollup: rollup({
          days_with_forecast: 1,
          days_beyond_forecast: 2,
          days_failed: 1,
          partly_unknown: true,
        }),
      }),
    );
    const coverage = (fixture.nativeElement as HTMLElement).querySelector('.coverage');
    expect(coverage?.textContent).toContain('1 of 4 days forecast');
    expect(coverage?.textContent).toContain('2 past the 10-day forecast');
    expect(coverage?.textContent).toContain("1 couldn't be routed");
    // The strip carries the grey marker only while something is genuinely unknown.
    expect(coverage?.querySelector('.sev')).not.toBeNull();
  });

  it('never tags a day "the one to watch" on an all-clear trip', () => {
    // The rollup names a worst day even when every day is calm; repeating it as a warning would
    // invent a concern out of an ordinal.
    const fixture = render(briefing());
    expect((fixture.nativeElement as HTMLElement).querySelector('.watch')).toBeNull();

    const rough = render(
      briefing({
        days: [
          day(0, { facts: facts(), severity: 'clear' }),
          day(1, { facts: facts({ overall_severity: 'severe' }), severity: 'severe' }),
        ],
        rollup: rollup({
          overall_severity: 'severe',
          worst_day_ordinal: 1,
          clear_day_ordinals: [0],
          rough_day_ordinals: [1],
        }),
      }),
    );
    expect(rows(rough)[0].querySelector('.watch')).toBeNull();
    expect(rows(rough)[1].querySelector('.watch')).not.toBeNull();
  });
});

/** The other half: this card is about the TRIP, and the surfaces above it are about one day. */
describe('TripBriefingCard — scope', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TripBriefingCard] }).compileComponents();
  });

  function render(response: ItineraryBriefingResponse, selectedDay: number | null = 0) {
    const fixture = TestBed.createComponent(TripBriefingCard);
    fixture.componentRef.setInput('briefing', response);
    fixture.componentRef.setInput('selectedDay', selectedDay);
    fixture.detectChanges();
    return fixture;
  }

  it('says what it covers and which day is on screen above it', () => {
    const fixture = render(briefing(), 1);
    const scope = (fixture.nativeElement as HTMLElement).querySelector('.scope')?.textContent ?? '';
    expect(scope).toContain('The whole trip');
    expect(scope).toContain('all 2 driving days');
    expect(scope).toContain('Day 2');
    // The selected row says the same thing from the other side.
    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.day')[1].querySelector('.shown'),
    ).not.toBeNull();
  });

  it('does not claim a timeline for a day that has no route drawn', () => {
    const fixture = render(
      briefing({
        days: [day(0, { facts: facts(), severity: 'clear' }), day(1, { beyond_forecast: true })],
        rollup: rollup({ days_with_forecast: 1, days_beyond_forecast: 1, partly_unknown: true }),
      }),
      1,
    );
    const scope = (fixture.nativeElement as HTMLElement).querySelector('.scope')?.textContent ?? '';
    expect(scope).toContain('Day 2 is the day selected above');
    expect(scope).not.toContain('timeline');
  });

  it('moves the selection from a day row, so the two scopes can be read against each other', () => {
    const fixture = render(briefing(), 0);
    const picked: number[] = [];
    fixture.componentInstance.selectedDayChange.subscribe((o: number) => picked.push(o));
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      '.body',
    );
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
    buttons[1].click();
    expect(picked).toEqual([1]);
  });

  it('renders the prose as text, never as markup', () => {
    const fixture = render(briefing({ text: '<img src=x onerror=alert(1)> 2 drives.' }));
    const prose = (fixture.nativeElement as HTMLElement).querySelector('.prose');
    expect(prose?.querySelector('img')).toBeNull();
    expect(prose?.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});

/**
 * What changed since the last look at this same trip (US-11, whole-trip half).
 *
 * The badge has one job and it is a job it can only do by staying quiet: it has to mean "we
 * compared this trip against your last look and something moved". Two separate ways of showing it
 * when nothing did — a first look, and a comparison that found nothing — are what these start with.
 */
describe('TripBriefingCard — the "Updated" badge, and which day leads', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TripBriefingCard] }).compileComponents();
  });

  function render(response: ItineraryBriefingResponse, selectedDay: number | null = 0) {
    const fixture = TestBed.createComponent(TripBriefingCard);
    fixture.componentRef.setInput('briefing', response);
    fixture.componentRef.setInput('selectedDay', selectedDay);
    fixture.detectChanges();
    return fixture;
  }

  const el = (fixture: { nativeElement: unknown }) => fixture.nativeElement as HTMLElement;
  const badge = (fixture: { nativeElement: unknown }) => el(fixture).querySelector('.updated');
  const rows = (fixture: { nativeElement: unknown }) => el(fixture).querySelectorAll('.day');

  it('shows no badge on a first look — nothing was compared', () => {
    // `diff` absent is the server saying no comparison happened, because the client had no
    // snapshot to send. A badge here would fire on every first briefing of every trip.
    const fixture = render(briefing());
    expect(fixture.componentInstance.rebrief()).toBe('unchecked');
    expect(badge(fixture)).toBeNull();
  });

  it('shows no badge when the comparison ran and found nothing', () => {
    // A DIFFERENT answer from the one above, and deliberately not the same state: a comparison
    // happened, the trip is exactly as it was left. Same silence, different reason.
    const fixture = render(
      briefing({ diff: { entries: [], has_changes: false, newly_forecast_ordinals: [] } }),
    );
    expect(fixture.componentInstance.rebrief()).toBe('unchanged');
    expect(badge(fixture)).toBeNull();
    expect(el(fixture).querySelector('.changed')).toBeNull();
  });

  it('shows the badge, in the single-day card’s own words, when something moved', () => {
    const fixture = render(
      briefing({
        days: [
          day(0, { facts: facts({ overall_severity: 'severe' }), severity: 'severe' }),
          day(1, { facts: facts(), severity: 'clear' }),
        ],
        rollup: rollup({ overall_severity: 'severe', worst_day_ordinal: 0 }),
        diff: {
          entries: [
            { ordinal: 0, kind: 'worsened', from_severity: 'clear', to_severity: 'severe' },
          ],
          has_changes: true,
          newly_forecast_ordinals: [],
        },
      }),
    );
    expect(fixture.componentInstance.rebrief()).toBe('changed');
    expect(badge(fixture)?.textContent).toContain('Updated');
    // The day that moved is marked; the day that did not is left alone.
    expect(rows(fixture)[0].querySelector('.changed')?.textContent).toContain('Worse than last');
    expect(rows(fixture)[1].querySelector('.changed')).toBeNull();
  });

  it('leads with the day that came into the forecast, not the day that worsened more', () => {
    // THE RULE. Day 1 went clear -> severe and is the rollup's worst day; day 3 merely arrived, at
    // caution. The arriving day still leads: the worsening was already on the traveller's radar,
    // and on a trip booked a month out an arrival is the one change they could not have expected.
    const fixture = render(
      briefing({
        days: [
          day(0, { facts: facts({ overall_severity: 'severe' }), severity: 'severe' }),
          day(1, { beyond_forecast: true }),
          day(2, { facts: facts({ overall_severity: 'caution' }), severity: 'caution' }),
        ],
        rollup: rollup({ overall_severity: 'severe', worst_day_ordinal: 0 }),
        diff: {
          entries: [
            { ordinal: 0, kind: 'worsened', from_severity: 'clear', to_severity: 'severe' },
            { ordinal: 2, kind: 'now_forecast', from_severity: null, to_severity: 'caution' },
          ],
          has_changes: true,
          // The server's own ranking. The card must not re-derive it from `entries`, which are
          // sorted worst-first and would have put day 1 in front.
          newly_forecast_ordinals: [2],
        },
      }),
    );
    expect(fixture.componentInstance.leadOrdinal()).toBe(2);
    expect(rows(fixture)[2].querySelector('.watch')?.textContent).toContain(
      'came into the forecast',
    );
    // The worst day keeps its marker but loses the lead — "the one to watch" is not what this
    // briefing is about any more.
    expect(rows(fixture)[0].querySelector('.watch')).toBeNull();
    expect(rows(fixture)[0].querySelector('.changed')?.textContent).toContain('Worse than last');
    // And the leading day does not say the same thing twice in one row.
    expect(rows(fixture)[2].querySelector('.changed')).toBeNull();
  });

  it('gives the lead back to the worst day when nothing arrived', () => {
    const fixture = render(
      briefing({
        days: [
          day(0, { facts: facts({ overall_severity: 'severe' }), severity: 'severe' }),
          day(1, { facts: facts(), severity: 'clear' }),
        ],
        rollup: rollup({ overall_severity: 'severe', worst_day_ordinal: 0 }),
        diff: {
          entries: [{ ordinal: 1, kind: 'eased', from_severity: 'caution', to_severity: 'clear' }],
          has_changes: true,
          newly_forecast_ordinals: [],
        },
      }),
    );
    expect(fixture.componentInstance.leadOrdinal()).toBe(0);
    expect(rows(fixture)[0].querySelector('.watch')?.textContent).toContain('the one to watch');
    // Spelled with the card's own scale words — the ones the dot beside it is labelled with.
    expect(rows(fixture)[1].querySelector('.changed')?.textContent).toContain(
      'Eased since last time: Caution → Clear',
    );
  });
});
