import { TestBed } from '@angular/core/testing';
import type { PlannedDayModel } from '@road-travel/sdk';
import { beforeEach, describe, expect, it } from 'vitest';

import { GeocodeService } from '../../core/geocode.service';
import { StopsEditor } from './stops-editor';
import { type StopDraft, newStop } from './waypoints';

const DALLAS = { name: 'Dallas, TX', latitude: 32.7767, longitude: -96.797 };
const ABQ = { name: 'Albuquerque, NM', latitude: 35.0844, longitude: -106.6504 };
const PHX = { name: 'Phoenix, AZ', latitude: 33.4484, longitude: -112.074 };
const LA = { name: 'Los Angeles, CA', latitude: 34.0522, longitude: -118.2437 };

const plannedDay = (ordinal: number): PlannedDayModel => ({
  ordinal,
  travel_date: null,
  nights_at_destination: 0,
  beyond_forecast: true,
  plan: null,
  error: null,
});

/** The stops editor: the stops and the days they add up to, edited as a draft until Done. */
describe('StopsEditor', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StopsEditor],
      providers: [{ provide: GeocodeService, useValue: { search: async () => [] } }],
    }).compileComponents();
  });

  function render(stops: StopDraft[], days: PlannedDayModel[] | null = null) {
    const fixture = TestBed.createComponent(StopsEditor);
    fixture.componentRef.setInput('stops', stops);
    fixture.componentRef.setInput('origin', DALLAS);
    fixture.componentRef.setInput('destination', LA);
    fixture.componentRef.setInput('departureAt', '2026-10-01T08:00');
    fixture.componentRef.setInput('days', days);
    fixture.detectChanges();
    const done: StopDraft[][] = [];
    fixture.componentInstance.done.subscribe((s) => done.push(s));
    return { fixture, el: fixture.nativeElement as HTMLElement, done };
  }

  const doneButton = (el: HTMLElement) =>
    [...el.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === 'Done',
    )!;

  it('lists the days under the stops — where "Your days" moved from the planner', () => {
    const { el } = render([newStop(ABQ, 0, 3), newStop(PHX, 0, 2, '09:30')]);
    expect(el.querySelectorAll('.stop-row')).toHaveLength(2);
    expect(el.querySelector('.caption')?.textContent).toContain('3 drives across 6 days, 5 nights');
    expect(el.querySelectorAll('.day')).toHaveLength(3);
  });

  it('hands back the edited stops on Done, and nothing before it', () => {
    const { fixture, el, done } = render([newStop(ABQ)]);
    fixture.componentInstance.draft.set([newStop(ABQ, 0, 2)]);
    fixture.detectChanges();
    expect(done).toHaveLength(0);

    doneButton(el).click();
    expect(done).toHaveLength(1);
    expect(done[0][0].nights).toBe(2);
  });

  it('leaves a row with no place behind — it could never have planned', () => {
    const { fixture, el, done } = render([newStop(ABQ)]);
    fixture.componentInstance.draft.set([newStop(ABQ), newStop(null, 0, 2)]);
    doneButton(el).click();
    expect(done[0].map((s) => s.place?.name)).toEqual([ABQ.name]);
  });

  it('drops the planned forecasts once the draft is a different trip', () => {
    // Days are matched to plans by ordinal. After a night is added the old day 2's weather would
    // sit on a new day 2 dated for a different morning.
    const stops = [newStop(ABQ, 0, 3)];
    const { fixture, el } = render(stops, [plannedDay(0), plannedDay(1)]);
    expect(el.querySelectorAll('.forecast').length).toBeGreaterThan(0);

    fixture.componentInstance.draft.set([{ ...stops[0], nights: 4 }]);
    fixture.detectChanges();
    expect(el.querySelectorAll('.forecast')).toHaveLength(0);
  });
});
