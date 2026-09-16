import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TOUR_COMMON_STEPS,
  TOUR_GUEST_FINAL,
  TOUR_LABELS,
  TOUR_SIGNED_IN_FINAL,
  type TourTarget,
  tourCountLabel,
  tourScript,
} from './tour-script';
import { TOUR_STORAGE_KEY, TourService } from './tour.service';

/**
 * The script is shared word for word with iOS. These are the literal strings from the shared
 * script — if one of these fails, the fix is almost never to edit the expectation.
 */
describe('tour script (shared with iOS — exact strings)', () => {
  it('has the four common steps, in order, verbatim', () => {
    expect(TOUR_COMMON_STEPS.map((s) => [s.target, s.title, s.body])).toEqual([
      ['places', 'Start here', "Type where you're leaving from and where you're going."],
      [
        'stops',
        'Add stops',
        'Give a stop nights to make it a multi-day trip — every driving day gets its own forecast.',
      ],
      [
        'plan',
        'See the weather on your route',
        "Every stretch of the drive, at the hour you'll reach it.",
      ],
      [
        'my-trips',
        'Your trips, everywhere',
        'Every trip you plan is saved here, on your phone and the web, and opens with the forecast you last saw.',
      ],
    ]);
  });

  it('ends a guest tour on Sign in, with the trial pitch', () => {
    expect(TOUR_GUEST_FINAL.target).toBe('account');
    expect(TOUR_GUEST_FINAL.title).toBe('Start your free trial');
    expect(TOUR_GUEST_FINAL.body).toBe(
      "Sign up to start your free 7-day trial — you'll need it to see forecasts.",
    );
    expect(tourScript(false).at(-1)).toBe(TOUR_GUEST_FINAL);
  });

  it('ends a signed-in tour on Settings', () => {
    expect(TOUR_SIGNED_IN_FINAL.target).toBe('settings');
    expect(TOUR_SIGNED_IN_FINAL.title).toBe('Settings');
    expect(TOUR_SIGNED_IN_FINAL.body).toBe('Units, appearance, and this tour again.');
    expect(tourScript(true).at(-1)).toBe(TOUR_SIGNED_IN_FINAL);
  });

  it('is five steps either way', () => {
    expect(tourScript(false)).toHaveLength(5);
    expect(tourScript(true)).toHaveLength(5);
  });

  it('labels its buttons, counter and replay entry exactly', () => {
    expect(TOUR_LABELS).toEqual({
      skip: 'Skip',
      back: 'Back',
      next: 'Next',
      done: 'Done',
      replay: 'Show app tour',
    });
    expect(tourCountLabel(2, 5)).toBe('2 of 5');
  });
});

describe('TourService', () => {
  let tour: TourService;
  const everything = () => true;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    tour = TestBed.inject(TourService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('starts at step 1 on a first visit', () => {
    expect(tour.status()).toBe('pending');
    expect(tour.start({ signedIn: false, isRendered: everything })).toBe(true);
    expect(tour.active()).toBe(true);
    expect(tour.index()).toBe(0);
    expect(tour.step()?.title).toBe('Start here');
    expect(tour.isFirst()).toBe(true);
  });

  it('walks forward and back, and Done on the last step completes it', () => {
    tour.start({ signedIn: false, isRendered: everything });
    tour.next();
    tour.next();
    expect(tour.step()?.id).toBe('plan');
    tour.back();
    expect(tour.step()?.id).toBe('stops');
    tour.next();
    tour.next();
    tour.next();
    expect(tour.isLast()).toBe(true);
    tour.next(); // Done
    expect(tour.active()).toBe(false);
    expect(localStorage.getItem(TOUR_STORAGE_KEY)).toBeTruthy();
  });

  it('Back on step 1 stays on step 1', () => {
    tour.start({ signedIn: false, isRendered: everything });
    tour.back();
    expect(tour.index()).toBe(0);
    expect(tour.active()).toBe(true);
  });

  it('shows once: Skip persists, and a later auto-start does nothing', () => {
    tour.start({ signedIn: false, isRendered: everything });
    tour.complete();
    expect(tour.active()).toBe(false);
    expect(tour.status()).toBe('done');
    expect(tour.shouldAutoStart()).toBe(false);
    expect(tour.start({ signedIn: false, isRendered: everything })).toBe(false);
    expect(tour.active()).toBe(false);
  });

  it('abandoning mid-tour counts as seen', () => {
    tour.start({ signedIn: false, isRendered: everything });
    tour.next();
    tour.abandon();
    expect(tour.status()).toBe('done');
  });

  it('a replay (force) starts at step 1 even after completion', () => {
    tour.start({ signedIn: true, isRendered: everything });
    tour.next();
    tour.complete();
    expect(tour.start({ signedIn: true, force: true, isRendered: everything })).toBe(true);
    expect(tour.index()).toBe(0);
  });

  it('never auto-starts when storage throws — it could never be dismissed for good', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(tour.status()).toBe('unavailable');
    expect(tour.shouldAutoStart()).toBe(false);
    expect(tour.start({ signedIn: false, isRendered: everything })).toBe(false);
  });

  it('treats storage that reads but cannot write as unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(tour.status()).toBe('unavailable');
    expect(tour.start({ signedIn: false, isRendered: everything })).toBe(false);
    // ...though Settings' replay still works, and completing it doesn't throw.
    expect(tour.start({ signedIn: false, force: true, isRendered: everything })).toBe(true);
    expect(() => tour.complete()).not.toThrow();
  });

  it('picks step 5 by account: Sign in for a guest, Settings when signed in', () => {
    tour.start({ signedIn: false, isRendered: everything });
    expect(tour.steps().at(-1)?.target).toBe('account');
    tour.complete();
    tour.start({ signedIn: true, force: true, isRendered: everything });
    expect(tour.steps().at(-1)?.target).toBe('settings');
  });

  it('drops a step whose target is not rendered, and counts what is left', () => {
    // A guest has no My Trips control at all.
    const rendered = (t: TourTarget) => t !== 'my-trips';
    tour.start({ signedIn: false, isRendered: rendered });
    expect(tour.steps().map((s) => s.id)).toEqual(['places', 'stops', 'plan', 'trial']);
  });

  it('skips a step whose target disappears mid-tour', () => {
    const gone = new Set<TourTarget>();
    tour.start({ signedIn: true, isRendered: (t) => !gone.has(t) });
    gone.add('stops');
    tour.next();
    expect(tour.step()?.id).toBe('plan');
    gone.add('places');
    tour.back();
    // Nothing before it is on screen any more: stay put.
    expect(tour.step()?.id).toBe('plan');
    gone.add('plan');
    tour.skipMissing();
    expect(tour.step()?.id).toBe('my-trips');
  });

  it('does not start when nothing it points at is on screen', () => {
    expect(tour.start({ signedIn: false, isRendered: () => false })).toBe(false);
    expect(tour.active()).toBe(false);
    // Nothing was shown, so nothing was recorded.
    expect(tour.status()).toBe('pending');
  });

  it('hands a replay request over exactly once', () => {
    expect(tour.takeReplay()).toBe(false);
    tour.requestReplay();
    expect(tour.takeReplay()).toBe(true);
    expect(tour.takeReplay()).toBe(false);
  });
});
