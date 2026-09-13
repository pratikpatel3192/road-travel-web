import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import type { TripLegModel, TripLegsResponse } from '@road-travel/sdk';

import { ApiService } from '../../core/api.service';
import { TripsService } from '../../core/trips.service';
import { SEVERITY_COLOR, SEVERITY_LEVELS } from '../plan/severity';
import { Itinerary } from './itinerary';

/** Derived from the scale, so a level added later joins the guard instead of slipping past it. */
const SEVERITY_VOCABULARY = [
  'severity',
  ...SEVERITY_LEVELS.map((level) => `sev-${level}`),
  ...Object.values(SEVERITY_COLOR),
];

const NOW = new Date('2026-09-12T12:00:00Z');
const day = (n: number): string => {
  const d = new Date(NOW.getTime() + n * 86_400_000);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const leg = (over: Partial<TripLegModel> = {}): TripLegModel => ({
  id: `leg-${Math.random()}`,
  ordinal: 0,
  origin: { name: 'Cupertino, CA', latitude: 37.32, longitude: -122.03 },
  destination: { name: 'Sacramento, CA', latitude: 38.58, longitude: -121.49 },
  waypoints: [],
  travel_date: day(3),
  ...over,
});

/**
 * The page under test with its two collaborators stubbed. `replaceTripLegs` echoes what it was
 * given, which is what the server does apart from assigning ids.
 */
function setup(legs: TripLegModel[], warnings: string[] = [], summary: string | null = null) {
  const calls: { legs: TripLegModel[] }[] = [];
  const api = {
    tripLegs: async (): Promise<TripLegsResponse> => ({ legs, warnings, summary }),
    replaceTripLegs: async (_id: string, sent: TripLegModel[]): Promise<TripLegsResponse> => {
      calls.push({ legs: sent });
      return { legs: sent, warnings: [], summary };
    },
  };
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      { provide: ApiService, useValue: api },
      { provide: TripsService, useValue: { saved: () => [] } },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: new Map([['tripId', 't1']]) } },
      },
    ],
  });
  const fixture = TestBed.createComponent(Itinerary);
  return { fixture, component: fixture.componentInstance, calls };
}

async function render(
  legs: TripLegModel[],
  warnings: string[] = [],
  summary: string | null = null,
) {
  const { fixture, component, calls } = setup(legs, warnings, summary);
  await component.ngOnInit();
  fixture.detectChanges();
  return {
    fixture,
    component,
    calls,
    text: (fixture.nativeElement as HTMLElement).textContent ?? '',
  };
}

describe('Itinerary — the forecast/outlook boundary', () => {
  it('says how much of the trip is real and what the rest is', async () => {
    // The acceptance criterion in one sentence: a reader who is not reading carefully must still
    // come away knowing the back half of this trip is history.
    const { text } = await render([leg({ travel_date: day(2) }), leg({ travel_date: day(30) })]);
    expect(text).toContain('real forecast');
    expect(text).toContain('history, not a forecast');
  });

  it('labels each day rather than leaving the tier implied by styling alone', async () => {
    const { text } = await render([leg({ travel_date: day(2) }), leg({ travel_date: day(30) })]);
    expect(text).toContain('Forecast');
    expect(text).toContain('Typical conditions');
  });

  it('does not claim history when every day is forecast', async () => {
    const { text } = await render([leg({ travel_date: day(1) }), leg({ travel_date: day(4) })]);
    expect(text).toContain('Every day of this trip has a real forecast');
    expect(text).not.toContain('history, not a forecast');
  });

  it('is explicit when the whole trip is still too far out', async () => {
    const { text } = await render([leg({ travel_date: day(40) })]);
    expect(text).toContain('too far out to forecast');
  });

  it('draws an outlook day differently from a forecast day', async () => {
    // Not the same chip as a forecast severity, and never a severity colour: the CSS classes carry
    // the distinction so it survives a glance.
    const { fixture } = await render([leg({ travel_date: day(2) }), leg({ travel_date: day(30) })]);
    const cells = (fixture.nativeElement as HTMLElement).querySelectorAll('.cell');
    expect(cells.length).toBe(2);
    expect(cells[0].classList.contains('forecast')).toBe(true);
    expect(cells[1].classList.contains('outlook')).toBe(true);

    // "never a severity colour" was only ever a comment here — the positive class assertions above
    // would have passed just as happily with a terracotta swatch on the outlook cell. Say it.
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    for (const forbidden of SEVERITY_VOCABULARY) {
      expect(html).not.toContain(forbidden);
    }
  });

  it('marks the cell where the forecast stops', async () => {
    const { fixture, component } = await render([
      leg({ travel_date: day(1) }),
      leg({ travel_date: day(2) }),
      leg({ travel_date: day(30) }),
    ]);
    expect(component.boundaryIndex()).toBe(2);
    const cells = (fixture.nativeElement as HTMLElement).querySelectorAll('.cell');
    expect(cells[2].classList.contains('boundary')).toBe(true);
  });

  it('draws no boundary on a trip that is entirely beyond the horizon', async () => {
    // Nothing changes at position zero, and a line there would suggest something did — the copy
    // says outright that the whole trip is too far out.
    const { component } = await render([
      leg({ travel_date: day(30) }),
      leg({ travel_date: day(31) }),
    ]);
    expect(component.boundaryIndex()).toBe(-1);
  });

  it('draws no boundary on a trip that is entirely forecast', async () => {
    const { component } = await render([
      leg({ travel_date: day(2) }),
      leg({ travel_date: day(4) }),
    ]);
    expect(component.boundaryIndex()).toBe(-1);
  });

  it('says an undated day shows nothing rather than guessing a date', async () => {
    const { text } = await render([leg({ travel_date: null })]);
    expect(text).toContain('No date');
    expect(text).toContain("We don't guess one");
  });
});

describe('Itinerary — the upgrade note', () => {
  it('shows the note the server wrote', async () => {
    const summary =
      'Your Sep 15 leg into Sacramento now has a real forecast — heavy snow. Worth a look.';
    const { text } = await render([leg({ upgrade_summary: summary })]);
    expect(text).toContain(summary);
  });

  it('renders nothing at all for a leg that was checked and came back fine', async () => {
    // The common case. There is no "all clear" badge on purpose: an empty summary means there was
    // nothing worth telling the driver, and drawing a reassurance would be inventing one.
    const { fixture } = await render([
      leg({ upgrade_checked_at: '2026-09-12T06:00:00Z', upgrade_summary: null }),
    ]);
    expect((fixture.nativeElement as HTMLElement).querySelector('.note')).toBeNull();
  });
});

describe('Itinerary — editing', () => {
  it('keeps each leg id so a save cannot re-arm its notification', async () => {
    // The server carries upgrade state across a wholesale replace BY ID. Dropping the id on a
    // reorder would make every save re-notify every leg.
    const { component, calls } = await render([leg({ id: 'a' }), leg({ id: 'b' })]);
    component.move(0, 1);
    await component.save();
    expect(calls[0].legs.map((l) => l.id)).toEqual(['b', 'a']);
  });

  it('renumbers ordinals from position, so order is never ambiguous', async () => {
    const { component, calls } = await render([
      leg({ id: 'a' }),
      leg({ id: 'b' }),
      leg({ id: 'c' }),
    ]);
    component.move(2, -1);
    await component.save();
    expect(calls[0].legs.map((l) => l.ordinal)).toEqual([0, 1, 2]);
    expect(calls[0].legs.map((l) => l.id)).toEqual(['a', 'c', 'b']);
  });

  it('clears the time when the date is cleared, rather than sending a rejected pair', async () => {
    // `departure_time` without `travel_date` is a 422 — a time on no day means nothing.
    const { component } = await render([leg({ departure_time: '09:00' })]);
    component.setDate(0, '');
    expect(component.legs()[0].departure_time).toBeNull();
    expect(component.legs()[0].travel_date).toBeNull();
  });

  it('chains a new day from where the last one ended', async () => {
    const { component } = await render([leg({ id: 'a' })]);
    component.newDestination.set({ name: 'Reno, NV', latitude: 39.53, longitude: -119.81 });
    component.add();
    const added = component.legs()[1];
    expect(added.origin.name).toBe('Sacramento, CA');
    expect(added.destination.name).toBe('Reno, NV');
  });

  it('defaults a new day to the day after the last dated one', async () => {
    const { component } = await render([leg({ travel_date: day(3) })]);
    component.newDestination.set({ name: 'Reno, NV', latitude: 39.53, longitude: -119.81 });
    component.add();
    expect(component.legs()[1].travel_date).toBe(day(4));
  });

  it('nothing is saved until asked', async () => {
    const { component, calls } = await render([leg()]);
    component.remove(0);
    expect(calls.length).toBe(0);
    expect(component.dirty()).toBe(true);
  });

  it('shows the server’s date warnings instead of blocking the save', async () => {
    // A driver mid-edit has a half-ordered itinerary by definition; refusing the save would throw
    // away their work to enforce a tidiness nobody asked for.
    const { text } = await render(
      [leg()],
      ['Leg 2 is dated before the leg above it. Check the order.'],
    );
    expect(text).toContain('Check the order');
  });
});

describe('Itinerary — the trip summary', () => {
  it("shows the server's paragraph verbatim", async () => {
    // Verbatim because it says what it can honestly say about a trip that is mostly history — a
    // client that rewrote it would be the client that got that wrong.
    const summary =
      '3 days of this trip have a real forecast; the other 2 show what those roads are usually ' +
      'like at that time of year.';
    const { text } = await render([leg({ travel_date: day(2) })], [], summary);
    expect(text).toContain(summary);
  });

  it('renders no summary block when the server sent none', async () => {
    const { fixture } = await render([leg({ travel_date: null })], [], null);
    expect((fixture.nativeElement as HTMLElement).querySelector('.summary')).toBeNull();
  });
});
