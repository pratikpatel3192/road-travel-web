import { TestBed } from '@angular/core/testing';

import { GeocodeService } from '../../core/geocode.service';
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
    el.querySelector<HTMLButtonElement>('button[aria-label="Remove stop 1"]')!.click();
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
    fixture.componentInstance.setDwell(1, 45);
    expect(fixture.componentInstance.stops().map((s) => s.dwellMinutes)).toEqual([0, 45]);
  });

  it('offers exactly the product dwell presets, 0 rendered as "Pass through"', () => {
    const fixture = render([newStop(HARRIS)]);
    const el = fixture.nativeElement as HTMLElement;
    const options = [...el.querySelectorAll('select option')].map((o) => o.textContent?.trim());
    expect(options).toEqual(['Pass through', '15 min', '30 min', '45 min', '60 min']);
  });
});
