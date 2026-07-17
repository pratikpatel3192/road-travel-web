import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type {
  AddStopPreviewResponse,
  ExploreResponse,
  PaywallResponse,
  PlaceCardModel,
  WaypointModel,
} from '@road-travel/sdk';
import { vi } from 'vitest';

import { ApiService } from '../../core/api.service';
import { PaywallError } from '../../core/errors';
import { PaywallService } from '../../core/paywall.service';
import { ExplorePanel } from './explore-panel';
import type { DwellMinutes } from './waypoints';
import type { PlaceValue } from './place-field';

const CUP = { name: 'Cupertino, CA', latitude: 37.323, longitude: -122.0322 };
const SAC = { name: 'Sacramento, CA', latitude: 38.5816, longitude: -121.4944 };
const DEPART = '2026-07-18T15:00:00.000Z';
const HARRIS: WaypointModel = {
  name: 'Harris Ranch, CA',
  latitude: 36.2519,
  longitude: -120.2378,
  dwell_minutes: 45,
};

const card = (over: Partial<PlaceCardModel> = {}): PlaceCardModel => ({
  name: 'Ragle Ranch Park',
  latitude: 37.05,
  longitude: -121.82,
  categories: ['park'],
  brand: null,
  open_at_pass_time: true,
  detour_meters: 1200,
  along_route_meters: 88_000,
  pass_eta: '2026-07-18T16:10:00Z',
  nearest_sample_index: 3,
  weather: {
    forecast_date: '2026-07-18T16:00:00Z',
    temperature_c: 22,
    condition_symbol: 'sun.max.fill',
    condition_text: 'Sunny',
    precipitation_chance: 0.05,
    wind_speed_kph: 10,
    severity: 'clear',
  },
  score: 1.2,
  source: 'mock',
  ...over,
});

const response = (over: Partial<ExploreResponse> = {}): ExploreResponse => ({
  intent: 'passenger_stops',
  cards: [card()],
  summary: 'Ragle Ranch Park is the closest match along this stretch.',
  summary_model: 'template',
  attribution: 'Mock data',
  refinements_applied: [],
  probe_count: 6,
  cache_hit: false,
  ...over,
});

const preview: AddStopPreviewResponse = {
  added_seconds: 22 * 60,
  added_meters: 9_000,
  dwell_seconds: 1_800,
  arrival_before: '2026-07-18T17:25:00Z',
  arrival_after: '2026-07-18T18:32:00Z',
  exposure_before: 4,
  exposure_after: 2,
  worst_before: 'caution',
  worst_after: 'caution',
};

describe('ExplorePanel (F-005 Trip Explorer)', () => {
  let api: {
    explore: ReturnType<typeof vi.fn>;
    addStopPreview: ReturnType<typeof vi.fn>;
    exploreFeedback: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    api = {
      explore: vi.fn(async () => response()),
      addStopPreview: vi.fn(async () => ({ ...preview })),
      exploreFeedback: vi.fn(async () => undefined),
    };
    await TestBed.configureTestingModule({
      imports: [ExplorePanel],
      providers: [provideRouter([]), { provide: ApiService, useValue: api }],
    }).compileComponents();
  });

  function render(waypoints: WaypointModel[] = []) {
    const fixture = TestBed.createComponent(ExplorePanel);
    fixture.componentRef.setInput('origin', CUP);
    fixture.componentRef.setInput('destination', SAC);
    fixture.componentRef.setInput('departureAt', DEPART);
    fixture.componentRef.setInput('waypoints', waypoints);
    fixture.detectChanges();
    return fixture;
  }

  /** Flush the pending api microtasks, then re-render. */
  async function flush(fixture: ComponentFixture<ExplorePanel>) {
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  }

  function intentButton(el: HTMLElement, label: string): HTMLButtonElement {
    const button = [...el.querySelectorAll<HTMLButtonElement>('.intent')].find((b) =>
      b.textContent?.includes(label),
    );
    expect(button).toBeTruthy();
    return button!;
  }

  function chipButton(el: HTMLElement, label: string): HTMLButtonElement {
    const button = [...el.querySelectorAll<HTMLButtonElement>('.chip')].find(
      (b) => b.textContent?.trim() === label,
    );
    expect(button).toBeTruthy();
    return button!;
  }

  it('runs an intent with the CURRENT trip identity — endpoints, departure AND waypoints', async () => {
    const fixture = render([HARRIS]);
    const el = fixture.nativeElement as HTMLElement;
    intentButton(el, 'Stops for passengers').click();
    await flush(fixture);

    expect(api.explore).toHaveBeenCalledTimes(1);
    const body = api.explore.mock.calls[0][0];
    expect(body.origin).toEqual(CUP);
    expect(body.destination).toEqual(SAC);
    expect(body.departure_at).toBe(DEPART);
    expect(body.waypoints).toEqual([HARRIS]);
    expect(body.intent).toBe('passenger_stops');
    expect('params' in body).toBe(false);

    // The ranked card renders name + category + detour + pass point + open state + weather.
    expect(el.querySelector('.name')?.textContent).toBe('Ragle Ranch Park');
    expect(el.querySelector('.cat')?.textContent).toBe('Park');
    expect(el.textContent).toContain('off-route');
    expect(el.textContent).toContain('near your');
    expect(el.querySelector('.open.yes')?.textContent).toBe('Open then');
    expect(el.querySelector('.wx-temp')?.textContent).toContain('72');
    expect(el.querySelector('.summary')?.textContent).toContain('closest match');
  });

  it('add_stop_search waits for a query and sends it as params.query', async () => {
    const fixture = render();
    const el = fixture.nativeElement as HTMLElement;
    intentButton(el, 'Add a stop…').click();
    fixture.detectChanges();
    expect(api.explore).not.toHaveBeenCalled(); // no query yet — the server would 422

    fixture.componentInstance.query = 'Starbucks';
    fixture.detectChanges();
    el.querySelector('form.query-row')!.dispatchEvent(new Event('submit'));
    await flush(fixture);

    expect(api.explore).toHaveBeenCalledTimes(1);
    expect(api.explore.mock.calls[0][0].intent).toBe('add_stop_search');
    expect(api.explore.mock.calls[0][0].params).toEqual({ query: 'Starbucks' });
  });

  it('refinement chips re-call WITH the prior params (the server serves its cache)', async () => {
    const fixture = render();
    const el = fixture.nativeElement as HTMLElement;
    intentButton(el, 'Add a stop…').click();
    fixture.componentInstance.query = 'Starbucks';
    fixture.detectChanges();
    el.querySelector('form.query-row')!.dispatchEvent(new Event('submit'));
    await flush(fixture);

    chipButton(el, 'Closer to halfway').click();
    await flush(fixture);

    expect(api.explore).toHaveBeenCalledTimes(2);
    const body = api.explore.mock.calls[1][0];
    expect(body.refinements).toEqual(['closer_to_halfway']);
    expect(body.params).toEqual({ query: 'Starbucks' }); // the prior query rides along
  });

  it('a category chip filters via params.category and toggles back off', async () => {
    const fixture = render();
    const el = fixture.nativeElement as HTMLElement;
    intentButton(el, 'Stops for passengers').click();
    await flush(fixture);

    chipButton(el, 'Playground').click();
    await flush(fixture);
    expect(api.explore.mock.calls[1][0].params).toEqual({ category: 'playground' });

    chipButton(el, 'Playground').click();
    await flush(fixture);
    expect('params' in api.explore.mock.calls[2][0]).toBe(false);
  });

  it('ALWAYS renders the source attribution — including the empty state', async () => {
    api.explore.mockResolvedValueOnce(response({ cards: [], summary: '' }));
    const fixture = render();
    const el = fixture.nativeElement as HTMLElement;
    intentButton(el, 'Scenic stops').click();
    await flush(fixture);

    expect(el.querySelector('.summary')?.textContent).toContain('No good options along this stretch');
    expect(el.querySelector('.attribution')?.textContent).toContain('Mock data');

    intentButton(el, 'Stops for passengers').click(); // and with results
    await flush(fixture);
    expect(el.querySelectorAll('.result').length).toBe(1);
    expect(el.querySelector('.attribution')?.textContent).toContain('Mock data');
  });

  it('add-as-stop previews with the CHOSEN dwell and confirm hands it to the F-006 flow', async () => {
    const fixture = render([HARRIS]);
    const el = fixture.nativeElement as HTMLElement;
    const added: { place: PlaceValue; dwellMinutes: DwellMinutes }[] = [];
    fixture.componentInstance.addStop.subscribe((e) => added.push(e));

    intentButton(el, 'Stops for passengers').click();
    await flush(fixture);
    el.querySelector<HTMLButtonElement>('.add-stop')!.click();
    await flush(fixture);

    // The preview is fetched with the default 30-min dwell AND the trip's existing waypoints.
    expect(api.addStopPreview).toHaveBeenCalledTimes(1);
    expect(api.addStopPreview.mock.calls[0][0].waypoints).toEqual([HARRIS]);
    expect(api.addStopPreview.mock.calls[0][0].stop).toEqual({
      name: 'Ragle Ranch Park',
      latitude: 37.05,
      longitude: -121.82,
      dwell_minutes: 30,
    });
    expect(el.querySelector('.delta')?.textContent).toContain('+22 m driving + 30 m stop');
    expect(el.querySelector('.delta')?.textContent).toContain('arrive');
    expect(el.querySelector('.delta-sub')?.textContent).toContain('weather exposure 4 → 2');
    expect(el.querySelector('.delta-sub')?.textContent).toContain('worst stretch unchanged');

    // Changing the dwell re-previews with the NEW dwell…
    fixture.componentInstance.setPreviewDwell(45);
    await flush(fixture);
    expect(api.addStopPreview).toHaveBeenCalledTimes(2);
    expect(api.addStopPreview.mock.calls[1][0].stop.dwell_minutes).toBe(45);

    // …and Confirm emits that chosen dwell for the plan page's existing add-stop path.
    el.querySelector<HTMLButtonElement>('.confirm')!.click();
    expect(added).toEqual([
      {
        place: { name: 'Ragle Ranch Park', latitude: 37.05, longitude: -121.82 },
        dwellMinutes: 45,
      },
    ]);
  });

  it('hides "Add as stop" when the trip already has 3 stops', async () => {
    const fixture = render([HARRIS, { ...HARRIS, name: 'B' }, { ...HARRIS, name: 'C' }]);
    const el = fixture.nativeElement as HTMLElement;
    intentButton(el, 'Stops for passengers').click();
    await flush(fixture);
    expect(el.querySelectorAll('.result').length).toBe(1);
    expect(el.querySelector('.add-stop')).toBeNull();
  });

  it('feedback posts the note for the intent, then clears into a Thanks state', async () => {
    const fixture = render();
    const el = fixture.nativeElement as HTMLElement;
    intentButton(el, 'Food near mealtime').click();
    await flush(fixture);

    el.querySelector<HTMLButtonElement>('.link')!.click();
    fixture.detectChanges();
    fixture.componentInstance.feedbackNote = 'more diners, fewer chains';
    fixture.detectChanges();
    el.querySelector('form.feedback')!.dispatchEvent(new Event('submit'));
    await flush(fixture);

    expect(api.exploreFeedback).toHaveBeenCalledWith({
      intent: 'food_mealtime',
      note: 'more diners, fewer chains',
    });
    // Cleared: the input is gone, the note is reset, and only a tiny Thanks remains (no answer).
    expect(fixture.componentInstance.feedbackNote).toBe('');
    expect(el.querySelector('form.feedback')).toBeNull();
    expect(el.querySelector('.thanks')?.textContent).toContain('Thanks');
  });

  it('surfaces a 402 as the existing paywall modal (server-gated Pro; no client gating)', async () => {
    const payload = { message: 'Start your free trial' } as PaywallResponse;
    api.explore.mockRejectedValueOnce(new PaywallError(payload));
    const fixture = render();
    intentButton(fixture.nativeElement as HTMLElement, 'Fuel / charge').click();
    await flush(fixture);
    expect(TestBed.inject(PaywallService).payload()).toEqual(payload);
  });
});
