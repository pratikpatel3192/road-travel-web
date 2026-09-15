import { TestBed } from '@angular/core/testing';
import type { PlannedDayModel, PlanTripResponse } from '@road-travel/sdk';

import { type DerivedLeg, deriveLegs } from '../../core/itinerary';
import type { PlaceValue } from './place-field';
import { SEVERITY_COLOR, UNKNOWN_LABEL } from './severity';
import { TravelDays } from './travel-days';

const DALLAS = { name: 'Dallas, TX', latitude: 32.7767, longitude: -96.797 };
const ABQ = { name: 'Albuquerque, NM', latitude: 35.0844, longitude: -106.6504 };
const LA = { name: 'Los Angeles, CA', latitude: 34.0522, longitude: -118.2437 };

/** A day's plan, trimmed to the fields the day card actually reads. */
const dayPlan = (over: Partial<PlanTripResponse> = {}): PlanTripResponse => ({
  origin: DALLAS,
  destination: ABQ,
  departure_at: '2026-10-01T13:00:00Z',
  arrival_at: '2026-10-01T22:00:00Z',
  distance_meters: 1_046_000, // 650 mi
  duration_seconds: 9 * 3600,
  waypoints: [],
  total_dwell_seconds: 0,
  worst_severity: 'clear',
  route_coordinates: [],
  samples: [],
  segments: [],
  meta: { sample_count: 0, segment_count: 0, route_point_count: 0, provider_mode: 'mock' },
  ...over,
});

const plannedDay = (ordinal: number, over: Partial<PlannedDayModel> = {}): PlannedDayModel => ({
  ordinal,
  travel_date: null,
  nights_at_destination: 0,
  beyond_forecast: false,
  plan: null,
  error: null,
  ...over,
});

/** The derived-day list: what the stops add up to, shown as a consequence rather than as inputs. */
describe('TravelDays', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TravelDays] }).compileComponents();
  });

  function render(legs: DerivedLeg<PlaceValue>[]) {
    const fixture = TestBed.createComponent(TravelDays);
    fixture.componentRef.setInput('legs', legs);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const dated = (departureDate: string | null) =>
    deriveLegs<PlaceValue>({
      origin: DALLAS,
      destination: LA,
      stops: [{ place: ABQ, nights: 3, departureTime: null }],
      departureDate,
      departureTime: '08:00',
    });

  it('lists one day per derived leg, with its date and the nights at the end of it', () => {
    const el = render(dated('2026-10-01'));
    const days = el.querySelectorAll('.day');
    expect(days.length).toBe(2);
    expect(days[0].textContent).toContain('Day 1');
    expect(days[0].textContent).toContain('Dallas, TX');
    expect(days[0].textContent).toContain('Albuquerque, NM');
    expect(days[0].textContent).toContain('3 nights');
    // The second day departs three nights later, and the list says so rather than making the
    // reader add it up.
    expect(days[1].textContent).toContain('Oct');
    expect(days[1].textContent).not.toContain('nights in');
  });

  it('says where the days came from', () => {
    const el = render(dated('2026-10-01'));
    expect(el.querySelector('.caption')?.textContent).toContain('from your stops');
    expect(el.querySelector('.caption')?.textContent).toContain('2 drives across 4 days');
  });

  it('shows an undated trip undated rather than inventing dates', () => {
    const el = render(dated(null));
    expect(el.textContent).toContain('No date yet');
    expect(el.textContent).not.toMatch(/\d{4}/);
  });

  it('says the 8 AM a day leaves an overnight stop at when nobody chose a time', () => {
    const el = render(dated('2026-10-01'));
    const leaves = [...el.querySelectorAll('.leaves')].map((n) => n.textContent?.trim());
    expect(leaves[0]).toBe('leaves 8 AM'); // the trip's own departure
    // Nobody said when they leave Albuquerque, so the server plans it at 08:00 — and the stop's
    // chip says "8 AM". "sometime that day" here would describe the same morning two ways.
    expect(leaves[1]).toBe('leaves 8 AM');
  });

  it('still spells out a first day with no departure time rather than inventing one', () => {
    const legs = deriveLegs<PlaceValue>({
      origin: DALLAS,
      destination: LA,
      stops: [{ place: ABQ, nights: 1, departureTime: null }],
      departureDate: '2026-10-01',
      departureTime: null,
    });
    const leaves = [...render(legs).querySelectorAll('.leaves')].map((n) => n.textContent?.trim());
    expect(leaves).toEqual(['sometime that day', 'leaves 8 AM']);
  });

  it('says nothing about weather until the trip has actually been planned', () => {
    const el = render(dated('2026-10-01'));
    expect(el.querySelector('.forecast')).toBeNull();
    // And the cards are not offered as a choice, because there is nothing to switch between.
    expect(el.querySelectorAll<HTMLButtonElement>('.body')[0].disabled).toBe(true);
  });

  it('names the pass-through stops on the leg they belong to', () => {
    const legs = deriveLegs<PlaceValue>({
      origin: DALLAS,
      destination: LA,
      stops: [
        {
          place: { name: 'Amarillo, TX', latitude: 35.222, longitude: -101.8313 },
          nights: 0,
          departureTime: null,
        },
        { place: ABQ, nights: 1, departureTime: '09:30' },
      ],
      departureDate: '2026-10-01',
      departureTime: '08:00',
    });
    const el = render(legs);
    expect(el.querySelectorAll('.day')[0].textContent).toContain('via Amarillo, TX');
    expect(el.querySelectorAll('.day')[1].textContent).toContain('leaves 9:30 AM');
  });
});

/**
 * The half of this surface that makes the trip honest: each day's OWN conditions, and the three
 * genuinely different reasons a day might not have any.
 */
describe('TravelDays — each day carries its own forecast', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TravelDays] }).compileComponents();
  });

  const legs = () =>
    deriveLegs<PlaceValue>({
      origin: DALLAS,
      destination: LA,
      stops: [{ place: ABQ, nights: 3, departureTime: null }],
      departureDate: '2026-10-01',
      departureTime: '08:00',
    });

  function render(days: PlannedDayModel[], over: { longDayOrdinals?: number[] } = {}) {
    const fixture = TestBed.createComponent(TravelDays);
    fixture.componentRef.setInput('legs', legs());
    fixture.componentRef.setInput('days', days);
    fixture.componentRef.setInput('longDayOrdinals', over.longDayOrdinals ?? []);
    fixture.componentRef.setInput('selectedDay', 0);
    fixture.detectChanges();
    return fixture;
  }

  it("shows each day's own severity and its own distance and driving time", () => {
    const fixture = render([
      plannedDay(0, { plan: dayPlan({ worst_severity: 'clear' }) }),
      plannedDay(1, {
        plan: dayPlan({
          worst_severity: 'severe',
          distance_meters: 1_207_000,
          duration_seconds: 7 * 3600,
        }),
      }),
    ]);
    const cards = (fixture.nativeElement as HTMLElement).querySelectorAll('.day');
    expect(cards[0].querySelector('.sev-label')?.textContent?.trim()).toBe('Clear');
    expect(cards[0].querySelector('.drive')?.textContent).toContain('650 mi');
    expect(cards[0].querySelector('.drive')?.textContent).toContain('9 h');
    // Day 2 is a DIFFERENT day's weather — the whole point. It was previously read off day 1.
    expect(cards[1].querySelector('.sev-label')?.textContent?.trim()).toBe('Severe');
    expect(cards[1].querySelector('.drive')?.textContent).toContain('750 mi');
  });

  it('colours the severity dot from the shared scale, never a local one', () => {
    const fixture = render([plannedDay(0, { plan: dayPlan({ worst_severity: 'high' }) })]);
    const dot = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.sev');
    // The DOM normalises a hex to `rgb()`, so the expectation goes through the same normalisation
    // rather than being written out by hand — a second spelling of the colour is a second source.
    const probe = document.createElement('span');
    probe.style.background = SEVERITY_COLOR.high;
    expect(dot?.style.background).toBe(probe.style.background);
  });

  it('an unrecognised severity degrades to the fail-safe rather than reading as clear', () => {
    // A level this build predates must never be drawn as the calm end of the scale. Asserted on
    // the component's own readers rather than by casting a bogus value into a typed response —
    // the point is that these go through `severityOrFallback`, not that the type can be defeated.
    const fixture = render([plannedDay(0, { plan: dayPlan() })]);
    expect(fixture.componentInstance.label('cataclysmic')).toBe('Caution');
    expect(fixture.componentInstance.color('cataclysmic')).toBe(SEVERITY_COLOR.caution);
  });

  it('says nobody forecasts that far out — and does not draw it as a failure', () => {
    const fixture = render([
      plannedDay(0, { plan: dayPlan() }),
      plannedDay(1, { beyond_forecast: true }),
    ]);
    const card = (fixture.nativeElement as HTMLElement).querySelectorAll('.day')[1];
    expect(card.querySelector('.sev-label')?.textContent?.trim()).toBe(UNKNOWN_LABEL);
    expect(card.textContent).toContain('closer to the day');
    // NOT an error: the error styling belongs to a day whose route actually failed.
    expect(card.querySelector('.day-error')).toBeNull();
  });

  it("says ONE day's route failed, without implying the rest did", () => {
    const fixture = render([
      plannedDay(0, { plan: dayPlan() }),
      plannedDay(1, { error: 'Route exceeds the supported length.' }),
    ]);
    const cards = (fixture.nativeElement as HTMLElement).querySelectorAll('.day');
    expect(cards[1].querySelector('.day-error')?.textContent).toContain(
      'Route exceeds the supported length.',
    );
    expect(cards[1].textContent).toContain('The other days are unaffected');
    // ...and day 1 still shows the forecast that did arrive.
    expect(cards[0].querySelector('.sev-label')).not.toBeNull();
  });

  it('flags a long day, and never offers to split it', () => {
    const fixture = render(
      [
        plannedDay(0, { plan: dayPlan({ duration_seconds: 12 * 3600 }) }),
        plannedDay(1, { plan: dayPlan() }),
      ],
      { longDayOrdinals: [0] },
    );
    const cards = (fixture.nativeElement as HTMLElement).querySelectorAll('.day');
    expect(cards[0].querySelector('.long')?.textContent).toContain('a long day');
    expect(cards[0].textContent).not.toMatch(/split|add a stop|break it up/i);
    expect(cards[1].querySelector('.long')).toBeNull();
  });

  it('matches a plan to its leg by ordinal, not by position', () => {
    // Day 0 missing from the response (a request that raced a stop edit). The surviving day must
    // land on ITS leg — sliding it up one would be the substitution in miniature.
    const fixture = render([plannedDay(1, { plan: dayPlan({ worst_severity: 'extreme' }) })]);
    const cards = (fixture.nativeElement as HTMLElement).querySelectorAll('.day');
    expect(cards[0].querySelector('.sev-label')).toBeNull();
    expect(cards[1].querySelector('.sev-label')?.textContent?.trim()).toBe('Extreme');
  });

  it('offers each day as a choice once there are plans, and reports the one picked', () => {
    const fixture = render([
      plannedDay(0, { plan: dayPlan() }),
      plannedDay(1, { plan: dayPlan() }),
    ]);
    const picked: number[] = [];
    fixture.componentInstance.selectedDayChange.subscribe((o: number) => picked.push(o));
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      '.body',
    );
    expect(buttons[0].disabled).toBe(false);
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
    buttons[1].click();
    expect(picked).toEqual([1]);
  });
});
