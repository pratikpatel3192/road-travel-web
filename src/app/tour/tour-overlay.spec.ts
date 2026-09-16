import { Component } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TourOverlay } from './tour-overlay';
import { TOUR_STORAGE_KEY, TourService } from './tour.service';

/**
 * A stand-in planner: one element per target, each given a real box (jsdom lays nothing out, so
 * every rect is otherwise zero — which the tour correctly reads as "not rendered").
 */
@Component({
  selector: 'app-host',
  imports: [TourOverlay],
  template: `
    <button id="before">outside</button>
    <div data-tour="places" id="origin"></div>
    <div data-tour="stops"></div>
    <div data-tour="places" id="destination"></div>
    <button data-tour="plan">Get briefing</button>
    <a data-tour="my-trips">My trips</a>
    <a data-tour="account">Sign in</a>
    <app-tour-overlay />
  `,
})
class Host {}

const BOXES: Record<string, { top: number; left: number; width: number; height: number }> = {
  origin: { top: 100, left: 30, width: 300, height: 40 },
  destination: { top: 190, left: 30, width: 300, height: 40 },
};

function box(el: Element) {
  const b = BOXES[el.id] ?? { top: 300, left: 40, width: 200, height: 40 };
  return {
    ...b,
    x: b.left,
    y: b.top,
    right: b.left + b.width,
    bottom: b.top + b.height,
    toJSON: () => b,
  } as DOMRect;
}

describe('TourOverlay', () => {
  let fixture: ComponentFixture<Host>;
  let tour: TourService;
  let root: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      // Only tagged elements (and nothing inside the overlay) have a box.
      return this.hasAttribute('data-tour')
        ? box(this)
        : ({ top: 0, left: 0, width: 0, height: 0, x: 0, y: 0, right: 0, bottom: 0 } as DOMRect);
    });
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    document.body.appendChild(fixture.nativeElement);
    root = fixture.nativeElement;
    tour = TestBed.inject(TourService);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    (fixture.nativeElement as HTMLElement).remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  async function render(): Promise<void> {
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(1);
    fixture.detectChanges();
  }

  const card = () => root.querySelector<HTMLElement>('[role="dialog"]');
  const button = (name: string) =>
    [...(card()?.querySelectorAll('button') ?? [])].find((b) => b.textContent?.trim() === name);
  const key = (k: string, shiftKey = false) => {
    const event = new KeyboardEvent('keydown', {
      key: k,
      shiftKey,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);
    return event;
  };

  async function start(signedIn = false): Promise<void> {
    expect(tour.start({ signedIn })).toBe(true);
    await render();
  }

  it('renders nothing until a tour starts', () => {
    expect(card()).toBeNull();
    expect(root.querySelector('.blocker')).toBeNull();
  });

  it('shows step 1 as a labelled modal dialog, and moves focus to it', async () => {
    root.querySelector<HTMLElement>('#before')!.focus();
    await start();
    const dialog = card()!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const title = document.getElementById(dialog.getAttribute('aria-labelledby')!)!;
    expect(title.textContent).toBe('Start here');
    expect(dialog.textContent).toContain("Type where you're leaving from and where you're going.");
    // All five of a guest's targets are in this host, so nothing is dropped from the count.
    expect(dialog.querySelector('.count')!.textContent).toBe('Step 1 of 5');
    expect(document.activeElement).toBe(dialog);
  });

  it('spotlights both place fields as one box', async () => {
    await start();
    const hole = root.querySelector<HTMLElement>('.hole')!;
    // origin top 100 → destination bottom 230, padded by 6 on each side.
    expect(hole.style.top).toBe('94px');
    expect(hole.style.height).toBe('142px');
    expect(hole.style.left).toBe('24px');
    expect(hole.style.width).toBe('312px');
  });

  it('offers Skip and Next on step 1, Back from step 2, and Done on the last', async () => {
    await start();
    expect(button('Skip')).toBeTruthy();
    expect(button('Next')).toBeTruthy();
    expect(button('Back')).toBeUndefined();
    button('Next')!.click();
    await render();
    expect(card()!.textContent).toContain('Add stops');
    expect(button('Back')).toBeTruthy();
    button('Next')!.click();
    button('Next')!.click();
    button('Next')!.click();
    await render();
    expect(card()!.textContent).toContain('Start your free trial');
    expect(card()!.querySelector('.count')!.textContent).toBe('Step 5 of 5');
    expect(button('Next')).toBeUndefined();
    button('Done')!.click();
    await render();
    expect(card()).toBeNull();
    expect(localStorage.getItem(TOUR_STORAGE_KEY)).toBeTruthy();
  });

  it('Skip ends it and remembers', async () => {
    await start();
    button('Skip')!.click();
    await render();
    expect(card()).toBeNull();
    expect(tour.status()).toBe('done');
  });

  it('Escape is Skip', async () => {
    await start();
    const event = key('Escape');
    await render();
    expect(event.defaultPrevented).toBe(true);
    expect(card()).toBeNull();
    expect(tour.status()).toBe('done');
  });

  it('returns focus to where it was when the tour ends', async () => {
    const before = root.querySelector<HTMLElement>('#before')!;
    before.focus();
    await start();
    key('Escape');
    await render();
    expect(document.activeElement).toBe(before);
  });

  it('keeps Tab inside the card', async () => {
    await start();
    button('Next')!.click();
    await render();
    // Step 2: Skip, Back, Next.
    const skip = button('Skip')!;
    const next = button('Next')!;
    next.focus();
    expect(key('Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(skip);
    expect(key('Tab', true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(next);
    // From the card itself (where focus lands), Shift+Tab wraps to the last button too.
    card()!.focus();
    key('Tab', true);
    expect(document.activeElement).toBe(next);
  });

  it('a click on the dimmed page neither reaches the page nor ends the tour', async () => {
    await start();
    const pageClick = vi.fn();
    root.addEventListener('click', pageClick);
    root.querySelector<HTMLElement>('.blocker')!.click();
    await render();
    expect(pageClick).not.toHaveBeenCalled();
    expect(card()).not.toBeNull();
    expect(tour.index()).toBe(0);
  });

  it('skips a step whose element is gone when it is reached', async () => {
    await start();
    root.querySelector('[data-tour="stops"]')!.remove();
    button('Next')!.click();
    await render();
    expect(card()!.textContent).toContain('See the weather on your route');
  });

  it('hides (without finishing) while another dialog is open, and ignores Escape meanwhile', async () => {
    await start();
    const other = document.createElement('div');
    other.setAttribute('aria-modal', 'true');
    document.body.appendChild(other);
    await vi.advanceTimersByTimeAsync(450);
    fixture.detectChanges();
    expect(card()).toBeNull();
    key('Escape');
    expect(tour.active()).toBe(true);
    other.remove();
    await vi.advanceTimersByTimeAsync(450);
    fixture.detectChanges();
    expect(card()).not.toBeNull();
  });
});
