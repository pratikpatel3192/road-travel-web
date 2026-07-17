import { TestBed } from '@angular/core/testing';
import type { BriefingFactsModel, BriefingResponse, FactsDiffModel } from '@road-travel/sdk';

import { BriefingCard } from './briefing-card';

const facts = (over: Partial<BriefingFactsModel> = {}): BriefingFactsModel => ({
  origin_name: 'San Francisco, CA',
  destination_name: 'Los Angeles, CA',
  departure_at: '2026-07-17T15:00:00Z',
  arrival_at: '2026-07-17T21:30:00Z',
  total_distance_meters: 613_000,
  duration_seconds: 6 * 3600,
  sample_count: 9,
  samples_with_weather: 9,
  overall_severity: 'caution',
  hazards: [],
  ...over,
});

const briefing = (over: Partial<BriefingResponse> = {}): BriefingResponse => ({
  text: 'Rain builds after Kettleman City. The worst stretch peaks near the Grapevine. Otherwise the drive is quiet.',
  brief: 'Rain builds after Kettleman City. The worst stretch peaks near the Grapevine.',
  facts: facts(),
  model: 'template',
  generated_at: '2026-07-17T14:00:00Z',
  verdict: 'caution',
  verdict_line: 'Mostly fine — one wet stretch mid-route.',
  claims: [
    { text: 'Rain builds after Kettleman City.', start_index: 3, end_index: 5 },
    { text: 'The worst stretch peaks near the Grapevine.', start_index: 6, end_index: 7 },
    { text: 'Otherwise the drive is quiet.', start_index: null, end_index: null },
  ],
  stale: false,
  ...over,
});

describe('BriefingCard (F-001 v2 progressive disclosure)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [BriefingCard] }).compileComponents();
  });

  function render(b: BriefingResponse = briefing()) {
    const fixture = TestBed.createComponent(BriefingCard);
    fixture.componentRef.setInput('briefing', b);
    fixture.detectChanges();
    return fixture;
  }

  /** US-6: the verdict chip is the SERVER's verdict, colored by the severity tokens. */
  it.each([
    ['clear', 'Clear', 'v-clear'],
    ['caution', 'Caution', 'v-caution'],
    ['consider-waiting', 'Consider waiting', 'v-consider-waiting'],
  ] as const)('renders the %s verdict chip with its label and token class', (verdict, label, cls) => {
    const el = render(briefing({ verdict })).nativeElement as HTMLElement;
    const chip = el.querySelector<HTMLElement>('.chip')!;
    expect(chip).toBeTruthy();
    expect(chip.textContent?.trim()).toBe(label);
    expect(chip.classList.contains(cls)).toBe(true);
    // The chip is followed by the ≤12-word verdict line.
    expect(el.querySelector('.verdict-line')?.textContent).toContain('one wet stretch');
    // The old severity badge is subsumed by the chip.
    expect(el.querySelector('.badge')).toBeNull();
  });

  it('falls back to the severity badge (still server data) when there is no verdict', () => {
    const el = render(briefing({ verdict: undefined, verdict_line: undefined })).nativeElement as HTMLElement;
    expect(el.querySelector('.chip')).toBeNull();
    expect(el.querySelector('.badge')?.textContent?.trim()).toBe('Caution');
  });

  /** US-7: two-sentence brief by default; "More" expands the full prose; "Less" collapses. */
  it('shows the brief by default and toggles to the full text via More/Less', () => {
    const fixture = render();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.prose')?.textContent).not.toContain('Otherwise the drive is quiet');

    const more = el.querySelector<HTMLButtonElement>('.more')!;
    expect(more.textContent?.trim()).toBe('More');
    more.click();
    fixture.detectChanges();
    expect(el.querySelector('.prose')?.textContent).toContain('Otherwise the drive is quiet');
    expect(el.querySelector<HTMLButtonElement>('.more')?.textContent?.trim()).toBe('Less');

    el.querySelector<HTMLButtonElement>('.more')!.click();
    fixture.detectChanges();
    expect(el.querySelector('.prose')?.textContent).not.toContain('Otherwise the drive is quiet');
  });

  it('renders the full text with no toggle when the server sent no brief (pre-v2)', () => {
    const el = render(briefing({ brief: undefined, claims: undefined })).nativeElement as HTMLElement;
    expect(el.querySelector('.prose')?.textContent).toContain('Otherwise the drive is quiet');
    expect(el.querySelector('.more')).toBeNull();
  });

  /** US-11 staleness: subtle glanceable note only when the server says the forecast is far out. */
  it('shows the stale note only when stale is true', () => {
    const stale = render(briefing({ stale: true })).nativeElement as HTMLElement;
    expect(stale.querySelector('.stale-note')?.textContent).toContain('re-check before leaving');

    const fresh = render(briefing({ stale: false })).nativeElement as HTMLElement;
    expect(fresh.querySelector('.stale-note')).toBeNull();
  });

  /** US-11 re-brief: an "Updated" badge when the diff is material (the prose leads with it). */
  it('shows the Updated badge only for a material diff', () => {
    const diff: FactsDiffModel = {
      entries: [],
      material: true,
      overall_from: 'clear',
      overall_to: 'caution',
    };
    const updated = render(briefing({ diff: { ...diff } })).nativeElement as HTMLElement;
    expect(updated.querySelector('.updated')?.textContent?.trim()).toBe('Updated');

    const immaterial = render(briefing({ diff: { ...diff, material: false } })).nativeElement as HTMLElement;
    expect(immaterial.querySelector('.updated')).toBeNull();

    const noDiff = render(briefing({ diff: null })).nativeElement as HTMLElement;
    expect(noDiff.querySelector('.updated')).toBeNull();
  });

  /** US-13 tap-to-inspect: a ref-carrying sentence of the FULL prose selects its sample range. */
  it('emits claimSelect for a linked sentence in the expanded prose; inert sentences do not', () => {
    const fixture = render();
    const el = fixture.nativeElement as HTMLElement;
    const emitted: number[] = [];
    fixture.componentInstance.claimSelect.subscribe((i) => emitted.push(i));

    el.querySelector<HTMLButtonElement>('.more')!.click();
    fixture.detectChanges();

    const sentences = el.querySelectorAll<HTMLElement>('.claim');
    expect(sentences.length).toBe(3);
    expect(sentences[0].classList.contains('linked')).toBe(true);
    expect(sentences[2].classList.contains('linked')).toBe(false);

    sentences[0].click(); // → start of its sample range
    sentences[2].click(); // no refs → inert
    expect(emitted).toEqual([3]);
  });
});
