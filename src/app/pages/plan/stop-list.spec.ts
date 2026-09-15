import { TestBed } from '@angular/core/testing';

import { GeocodeService } from '../../core/geocode.service';
import { PlaceField } from './place-field';
import { StopList } from './stop-list';
import { MAX_STOPS, type StopDraft, newStop } from './waypoints';

const HARRIS = { name: 'Harris Ranch, CA', latitude: 36.2519, longitude: -120.2378 };
const KETTLEMAN = { name: 'Kettleman City, CA', latitude: 36.0083, longitude: -119.9618 };

/** F-006 stop editor: add/remove/reorder/dwell rows, hard-capped at 3 stops. */
describe('StopList (F-006 stop editor)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StopList],
      // The embedded place-fields only geocode while typing, but keep the network out anyway.
      providers: [{ provide: GeocodeService, useValue: { search: async () => [] } }],
    }).compileComponents();
  });

  function render(stops: StopDraft[] = []) {
    const fixture = TestBed.createComponent(StopList);
    fixture.componentRef.setInput('stops', stops);
    fixture.detectChanges();
    return fixture;
  }

  const rows = (el: HTMLElement) => el.querySelectorAll('.stop-row');
  const addButton = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('button.add');

  it('starts with no rows and just the "+ Add stop" affordance', () => {
    const el = render().nativeElement as HTMLElement;
    expect(rows(el).length).toBe(0);
    expect(addButton(el)?.textContent).toContain('+ Add stop');
  });

  it('adds an (empty) stop row per click and emits the new array', () => {
    const fixture = render();
    const el = fixture.nativeElement as HTMLElement;
    addButton(el)!.click();
    fixture.detectChanges();
    expect(rows(el).length).toBe(1);
    expect(fixture.componentInstance.stops()).toHaveLength(1);
    expect(fixture.componentInstance.stops()[0].place).toBeNull();
    expect(fixture.componentInstance.stops()[0].dwellMinutes).toBe(0);
  });

  it(`caps at ${MAX_STOPS} stops — the add affordance disappears`, () => {
    const fixture = render();
    const el = fixture.nativeElement as HTMLElement;
    for (let i = 0; i < MAX_STOPS; i++) {
      addButton(el)!.click();
      fixture.detectChanges();
    }
    expect(rows(el).length).toBe(MAX_STOPS);
    expect(addButton(el)).toBeNull(); // hidden at the cap
    fixture.componentInstance.add(); // programmatic add must be a no-op too
    expect(fixture.componentInstance.stops()).toHaveLength(MAX_STOPS);
  });

  it('removes a row via its ✕ button', () => {
    const fixture = render([newStop(HARRIS, 15), newStop(KETTLEMAN, 30)]);
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>(`button[aria-label="Remove stop ${HARRIS.name}"]`)!.click();
    fixture.detectChanges();
    expect(rows(el).length).toBe(1);
    expect(fixture.componentInstance.stops()[0].place?.name).toBe(KETTLEMAN.name);
  });

  it('reorders with the up/down arrows and disables them at the edges', () => {
    const fixture = render([newStop(HARRIS, 15), newStop(KETTLEMAN, 30)]);
    const el = fixture.nativeElement as HTMLElement;
    const up1 = el.querySelector<HTMLButtonElement>('button[aria-label="Move stop 1 earlier"]')!;
    const down2 = el.querySelector<HTMLButtonElement>('button[aria-label="Move stop 2 later"]')!;
    expect(up1.disabled).toBe(true);
    expect(down2.disabled).toBe(true);

    el.querySelector<HTMLButtonElement>('button[aria-label="Move stop 2 earlier"]')!.click();
    fixture.detectChanges();
    const names = fixture.componentInstance.stops().map((s) => s.place?.name);
    expect(names).toEqual([KETTLEMAN.name, HARRIS.name]);
    // Dwell rides with its stop through the reorder.
    expect(fixture.componentInstance.stops().map((s) => s.dwellMinutes)).toEqual([30, 15]);
  });

  it('updates dwell for the edited row only', () => {
    const fixture = render([newStop(HARRIS, 0), newStop(KETTLEMAN, 0)]);
    fixture.componentInstance.setStay(1, 'm45');
    expect(fixture.componentInstance.stops().map((s) => s.dwellMinutes)).toEqual([0, 45]);
  });

  it('offers pauses and stays on ONE ordered list', () => {
    // This was two controls — a nights box and a dwell select — and at zero they both read as
    // passing through, so a row asked the same question twice in two shapes.
    const fixture = render([newStop(HARRIS)]);
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('button.stay-chip')!.click();
    fixture.detectChanges();
    const options = [...el.querySelectorAll('select option')].map((o) => o.textContent?.trim());
    expect(options.slice(0, 5)).toEqual(['Pass through', '15 min', '30 min', '45 min', '60 min']);
    expect(options).toContain('1 night');
    expect(options).toContain('3 nights');
    // One word for passing through, not two controls that each say it.
    expect(options.filter((o) => o === 'Pass through')).toHaveLength(1);
  });
});

/**
 * The multi-day row. One duration list covers pauses and stays; choosing a stay raises a SECOND
 * question the list cannot answer — what time you set off the next morning — and only then.
 */
describe('StopList (overnight stops)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StopList],
      providers: [{ provide: GeocodeService, useValue: { search: async () => [] } }],
    }).compileComponents();
  });

  function render(stops: StopDraft[]) {
    const fixture = TestBed.createComponent(StopList);
    fixture.componentRef.setInput('stops', stops);
    fixture.detectChanges();
    return fixture;
  }

  const dwell = (el: HTMLElement) => el.querySelector('.dwell select');
  const departAt = (el: HTMLElement) =>
    el.querySelector<HTMLInputElement>('input[aria-label="Departure time from stop 1"]');
  const openStay = (fixture: ReturnType<typeof render>) => {
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button.stay-chip')!
      .click();
    fixture.detectChanges();
  };

  it('asks how long a pass-through lasts, and says nothing about departure', () => {
    const fixture = render([newStop(HARRIS, 30)]);
    openStay(fixture);
    const el = fixture.nativeElement as HTMLElement;
    expect(dwell(el)).not.toBeNull();
    expect(departAt(el)).toBeNull();
  });

  it('raises the departure-time question only once the stop has a night', () => {
    const fixture = render([newStop(HARRIS, 30)]);
    openStay(fixture);
    const el = fixture.nativeElement as HTMLElement;
    expect(departAt(el)).toBeNull();
    fixture.componentInstance.setStay(0, 'n2');
    fixture.detectChanges();
    // The duration list stays — it is one control now — and the time appears beside it.
    expect(dwell(el)).not.toBeNull();
    expect(departAt(el)).not.toBeNull();
  });

  it('edits only its own row', () => {
    // A single list of durations replaced the number box, so there is nothing to clamp: an option
    // nobody offered cannot be chosen. What still matters is that it touches one row.
    const fixture = render([newStop(HARRIS), newStop(KETTLEMAN)]);
    fixture.componentInstance.setStay(1, 'n2');
    expect(fixture.componentInstance.stops().map((s) => s.nights)).toEqual([0, 2]);
  });

  it('a stop is a pause or a stay, never both — the server rejects the pair', () => {
    const fixture = render([newStop(HARRIS, 45)]);
    fixture.componentInstance.setStay(0, 'n3');
    const stop = fixture.componentInstance.stops()[0];
    expect(stop.nights).toBe(3);
    expect(stop.dwellMinutes).toBe(0);
  });

  it('drops the departure time when the stay goes — a time to leave nowhere means nothing', () => {
    const fixture = render([newStop(HARRIS, 0, 2, '09:30')]);
    fixture.componentInstance.setStay(0, 'pass');
    expect(fixture.componentInstance.stops()[0].departureTime).toBeNull();
    // The dwell the traveller had set is untouched, so flipping back restores their stop.
    expect(fixture.componentInstance.stops()[0].dwellMinutes).toBe(0);
  });

  it('keeps a cleared departure time as null, so the server default applies and nothing is sent', () => {
    const fixture = render([newStop(HARRIS, 0, 1, '09:30')]);
    fixture.componentInstance.setDepartureTime(0, '');
    expect(fixture.componentInstance.stops()[0].departureTime).toBeNull();
  });
});

/**
 * A row shows its stay as ONE chip and edits it on tap. Side by side, a duration picker and a time
 * input truncated the time to "An…" on a phone and made every stop two controls tall.
 */
describe('StopList (stay chip)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StopList],
      providers: [{ provide: GeocodeService, useValue: { search: async () => [] } }],
    }).compileComponents();
  });

  function render(stops: StopDraft[]) {
    const fixture = TestBed.createComponent(StopList);
    fixture.componentRef.setInput('stops', stops);
    fixture.detectChanges();
    return fixture;
  }

  const chips = (el: HTMLElement) =>
    [...el.querySelectorAll<HTMLButtonElement>('button.stay-chip')].map((c) =>
      c.textContent?.trim(),
    );

  it('summarises each stay on its row, with no picker on screen until asked', () => {
    const el = render([
      newStop(HARRIS),
      newStop(KETTLEMAN, 30),
      newStop(HARRIS, 0, 2),
      newStop(KETTLEMAN, 0, 1, '09:30'),
    ]).nativeElement as HTMLElement;
    expect(chips(el)).toEqual(['Pass', '30 min', '2 nights · 8 AM', '1 night · 9:30 AM']);
    expect(el.querySelector('select')).toBeNull();
    expect(el.querySelector('input[type="time"]')).toBeNull();
  });

  it('opens one stay at a time, and the chip follows the edit', () => {
    const fixture = render([newStop(HARRIS), newStop(KETTLEMAN)]);
    const el = fixture.nativeElement as HTMLElement;
    const buttons = () => el.querySelectorAll<HTMLButtonElement>('button.stay-chip');
    buttons()[0].click();
    fixture.detectChanges();
    buttons()[1].click();
    fixture.detectChanges();
    expect(el.querySelectorAll('.dwell select')).toHaveLength(1);
    expect(buttons()[1].getAttribute('aria-expanded')).toBe('true');

    fixture.componentInstance.setStay(1, 'n2');
    fixture.detectChanges();
    expect(chips(el)[1]).toBe('2 nights · 8 AM');
  });

  it('shows the 8 AM default in the time input without storing it', () => {
    const fixture = render([newStop(HARRIS, 0, 2)]);
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('button.stay-chip')!.click();
    fixture.detectChanges();
    // Stored as null so the waypoint goes out without `departure_time` and the server's default
    // applies — the label and the plan cannot then disagree.
    expect(fixture.componentInstance.stops()[0].departureTime).toBeNull();
    expect(el.querySelector('.default')?.textContent).toContain('8 AM');
  });
});

/**
 * One × per stop row. The place field used to bring its own clear × beside the row's remove ×, so
 * a row read "Joliet, IL × ×" — two identical glyphs, one clearing text and one deleting the stop.
 */
describe('StopList (one delete per row)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StopList],
      providers: [{ provide: GeocodeService, useValue: { search: async () => [] } }],
    }).compileComponents();
  });

  it('offers only the remove control, named for the stop it removes', () => {
    const fixture = TestBed.createComponent(StopList);
    fixture.componentRef.setInput('stops', [newStop(HARRIS), newStop(null)]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('button.clear')).toBeNull();
    const rows = el.querySelectorAll('.stop-row');
    expect(rows[0].querySelectorAll('app-icon[name="x"]')).toHaveLength(1);
    const labels = [...el.querySelectorAll('button.remove')].map((b) =>
      b.getAttribute('aria-label'),
    );
    // A row still being typed has no name yet, so it falls back to its number.
    expect(labels).toEqual([`Remove stop ${HARRIS.name}`, 'Remove stop 2']);
  });

  it("leaves the planner's origin and destination fields their clear — their only way to empty", () => {
    const fixture = TestBed.createComponent(PlaceField);
    fixture.componentRef.setInput('kind', 'origin');
    fixture.componentRef.setInput('place', HARRIS);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('button.clear')).not.toBeNull();
  });
});
