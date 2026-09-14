import { TestBed } from '@angular/core/testing';

import { type DerivedLeg, deriveLegs } from '../../core/itinerary';
import type { PlaceValue } from './place-field';
import { TravelDays } from './travel-days';

const DALLAS = { name: 'Dallas, TX', latitude: 32.7767, longitude: -96.797 };
const ABQ = { name: 'Albuquerque, NM', latitude: 35.0844, longitude: -106.6504 };
const LA = { name: 'Los Angeles, CA', latitude: 34.0522, longitude: -118.2437 };

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

  it('spells out an unanswered departure time instead of leaving a blank', () => {
    const el = render(dated('2026-10-01'));
    const leaves = [...el.querySelectorAll('.leaves')].map((n) => n.textContent?.trim());
    expect(leaves[0]).toBe('leaves 08:00'); // the trip's own departure
    expect(leaves[1]).toBe('sometime that day'); // nobody said when they leave Albuquerque
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
    expect(el.querySelectorAll('.day')[1].textContent).toContain('leaves 09:30');
  });
});
