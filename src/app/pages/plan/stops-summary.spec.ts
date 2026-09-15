import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import {
  StopsSummary,
  deriveTripDays,
  formatClock,
  stayChipLabel,
  stopsSummaryLabel,
} from './stops-summary';
import { type StopDraft, newStop, toWaypoints } from './waypoints';

const CHICAGO = { name: 'Chicago, IL', latitude: 41.8781, longitude: -87.6298 };
const STL = { name: 'St. Louis, MO', latitude: 38.627, longitude: -90.1994 };
const KC = { name: 'Kansas City, MO', latitude: 39.0997, longitude: -94.5786 };
const DENVER = { name: 'Denver, CO', latitude: 39.7392, longitude: -104.9903 };

/**
 * The planner's one line for every stop on the trip. The day count is the pinned derivation's
 * (`totalDays(deriveLegs(...))`), so these are checks of the wording and of the seam, not a second
 * statement of the arithmetic.
 */
describe('stopsSummaryLabel', () => {
  it('offers to add stops when there are none', () => {
    expect(stopsSummaryLabel([])).toBe('+ Add stops');
  });

  it('is singular for one stop and one day', () => {
    expect(stopsSummaryLabel([newStop(STL, 30)])).toBe('1 stop · 1 day');
  });

  it('is one day for stops nobody stays at', () => {
    expect(stopsSummaryLabel([newStop(STL), newStop(KC, 45)])).toBe('2 stops · 1 day');
  });

  it('counts the calendar span the nights make', () => {
    // Chicago → St. Louis (3 nights) → KC (pass) → Denver (4 nights): 1 + 7 = 8 days.
    expect(stopsSummaryLabel([newStop(STL, 0, 3), newStop(KC, 15), newStop(DENVER, 0, 4)])).toBe(
      '3 stops · 8 days',
    );
    expect(stopsSummaryLabel([newStop(STL, 0, 1), newStop(DENVER, 0, 6)])).toBe('2 stops · 8 days');
  });

  it('ignores a row still being typed — it plans nothing, so it is not a stop yet', () => {
    expect(stopsSummaryLabel([newStop(null, 0, 2)])).toBe('+ Add stops');
    expect(stopsSummaryLabel([newStop(STL, 0, 1), newStop(null, 0, 5)])).toBe('1 stop · 2 days');
  });

  it('agrees with the day list the planner derives from the same stops', () => {
    const stops = [newStop(STL, 0, 2), newStop(KC, 0, 3)];
    const legs = deriveTripDays({
      origin: CHICAGO,
      destination: DENVER,
      stops,
      departureAt: '2026-10-01T08:00',
    });
    // First day out on the 1st, last day on the 6th: six days, whatever the label says must match.
    expect(legs[legs.length - 1].travelDate).toBe('2026-10-06');
    expect(stopsSummaryLabel(stops)).toBe('2 stops · 6 days');
  });
});

describe('stayChipLabel', () => {
  it('names a pass-through and a pause', () => {
    expect(stayChipLabel(newStop(STL))).toBe('Pass');
    expect(stayChipLabel(newStop(STL, 30))).toBe('30 min');
  });

  it('shows the 8 AM default on a stay with no chosen time', () => {
    expect(stayChipLabel(newStop(STL, 0, 1))).toBe('1 night · 8 AM');
  });

  it('shows a chosen time', () => {
    expect(stayChipLabel(newStop(STL, 0, 2, '09:30'))).toBe('2 nights · 9:30 AM');
  });

  it('describes the stay, not a dwell the server would reject alongside it', () => {
    expect(stayChipLabel({ dwellMinutes: 45, nights: 2, departureTime: null })).toBe(
      '2 nights · 8 AM',
    );
  });
});

describe('formatClock', () => {
  it('reads wire times as a traveller would', () => {
    expect(formatClock('08:00')).toBe('8 AM');
    expect(formatClock('00:00')).toBe('12 AM');
    expect(formatClock('12:00')).toBe('12 PM');
    expect(formatClock('18:05')).toBe('6:05 PM');
    expect(formatClock('09:30:00')).toBe('9:30 AM');
  });

  it('shows anything else as it came rather than inventing a time', () => {
    expect(formatClock('soon')).toBe('soon');
    expect(formatClock('25:00')).toBe('25:00');
  });
});

describe('a defaulted departure time', () => {
  it('is not sent, so the server default applies and the two cannot disagree', () => {
    const [waypoint] = toWaypoints([newStop(STL, 0, 2)]);
    expect(waypoint.nights).toBe(2);
    expect('departure_time' in waypoint).toBe(false);
  });

  it('is sent once the traveller picks one — even 8 AM', () => {
    expect(toWaypoints([newStop(STL, 0, 2, '08:00')])[0].departure_time).toBe('08:00');
  });
});

describe('StopsSummary', () => {
  function render(stops: StopDraft[]) {
    TestBed.configureTestingModule({ imports: [StopsSummary] });
    const fixture = TestBed.createComponent(StopsSummary);
    fixture.componentRef.setInput('stops', stops);
    fixture.detectChanges();
    return fixture;
  }

  it('is one line however many stops there are, and opens the editor', () => {
    const stops = [1, 2, 3, 4, 5, 6].map((n) => newStop({ ...STL, name: `Stop ${n}` }, 0, 1));
    const fixture = render(stops);
    const el = fixture.nativeElement as HTMLElement;
    let opened = 0;
    fixture.componentInstance.edit.subscribe(() => opened++);

    expect(el.querySelectorAll('button')).toHaveLength(1);
    expect(el.textContent).toContain('6 stops · 7 days');
    expect(el.textContent).toContain('Edit');
    el.querySelector('button')!.click();
    expect(opened).toBe(1);
  });

  it('reads as an invitation with no stops', () => {
    const el = render([]).nativeElement as HTMLElement;
    expect(el.textContent?.trim()).toBe('+ Add stops');
  });
});
