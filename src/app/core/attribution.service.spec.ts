import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { AttributionService } from './attribution.service';

/**
 * ADR-0048: capture `?utm_*` and carry it to the server. The client's only jobs are to not lose a
 * campaign arrival on the way, and to not let a reload loop grow the queue without bound — the
 * server keeps the history and decides which campaign counts.
 */
describe('AttributionService', () => {
  let service: AttributionService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AttributionService);
  });

  it('queues a campaign arrival', () => {
    expect(service.capture('?utm_source=reddit&utm_medium=social&utm_campaign=launch', '')).toBe(
      true,
    );
    const [touch] = service.pending;
    expect(touch.utm_source).toBe('reddit');
    expect(touch.utm_campaign).toBe('launch');
  });

  it('keeps the referring URL it was given — the SERVER reduces it to a host', () => {
    service.capture('?utm_source=reddit', 'https://www.reddit.com/r/roadtrip/');
    expect(service.pending[0].referrer).toBe('https://www.reddit.com/r/roadtrip/');
  });

  it.each([
    ['', 'no query string'],
    ['?utm_term=winter', 'term alone names no source'],
    ['?ref=creator-a', 'a referral is a different mechanism'],
    ['?from=Austin&to=Dallas', 'ordinary planner params'],
  ])('queues nothing for %s (%s)', (search) => {
    expect(service.capture(search, '')).toBe(false);
    expect(service.pending).toEqual([]);
  });

  it('a reload under the SAME campaign is not a new arrival', () => {
    expect(service.capture('?utm_source=reddit&utm_medium=social', '')).toBe(true);
    expect(service.capture('?utm_source=reddit&utm_medium=social', '')).toBe(false);
    expect(service.pending).toHaveLength(1);
  });

  it('a genuinely different campaign IS a new arrival', () => {
    service.capture('?utm_source=reddit&utm_medium=social', '');
    expect(service.capture('?utm_source=google&utm_medium=cpc', '')).toBe(true);
    expect(service.pending).toHaveLength(2);
  });

  it('caps the queue, keeping the most recent — a bot cannot grow it without bound', () => {
    for (let i = 0; i < 25; i++) service.capture(`?utm_source=s${i}`, '');
    const q = service.pending;
    expect(q).toHaveLength(10);
    expect(q[q.length - 1].utm_source).toBe('s24');
  });

  it('clearSent drops only the prefix that was posted', () => {
    service.capture('?utm_source=a', '');
    service.capture('?utm_source=b', '');
    service.capture('?utm_source=c', '');
    const pending = service.pending;
    service.clearSent(pending.slice(0, 2));
    expect(service.pending.map((t) => t.utm_source)).toEqual(['c']);
  });

  it('a touch captured DURING a drain survives it', () => {
    service.capture('?utm_source=a', '');
    const inFlight = service.pending; // what the drain is posting
    service.capture('?utm_source=b', ''); // arrives mid-flight
    service.clearSent(inFlight);
    expect(service.pending.map((t) => t.utm_source)).toEqual(['b']);
  });

  it('survives a hand-edited or corrupt queue', () => {
    localStorage.setItem('rt_utm_q', 'not json');
    expect(service.pending).toEqual([]);
    expect(service.capture('?utm_source=reddit', '')).toBe(true);
    expect(service.pending).toHaveLength(1);
  });

  it('a non-array value in storage is ignored rather than trusted', () => {
    localStorage.setItem('rt_utm_q', '{"utm_source":"evil"}');
    expect(service.pending).toEqual([]);
  });
});

/**
 * The claim path. Found by running the server against a real Postgres: the queue alone left the
 * COMMONEST conversion path unattributed — arrive under a campaign anonymously, drain it, sign up
 * later, never click another campaign link. The server never saw a signed-in touch, so it never
 * claimed the earlier arrivals and the account never reached the ROI roll-up at all.
 */
describe('AttributionService — the signed-in re-report', () => {
  let service: AttributionService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AttributionService);
  });

  it('offers the last campaign for re-report until it is claimed', () => {
    service.capture('?utm_source=reddit&utm_medium=social', '');
    expect(service.unclaimed?.utm_source).toBe('reddit');
    service.markClaimed();
    expect(service.unclaimed).toBeNull();
  });

  it('offers nothing when no campaign was ever captured', () => {
    expect(service.unclaimed).toBeNull();
  });

  it('survives the queue being drained — the last campaign is kept separately', () => {
    service.capture('?utm_source=reddit', '');
    service.clearSent(service.pending);
    expect(service.pending).toEqual([]);
    expect(service.unclaimed?.utm_source).toBe('reddit');
  });

  it('a NEW campaign re-opens the claim, so last_* follows the newest arrival', () => {
    service.capture('?utm_source=reddit', '');
    service.markClaimed();
    expect(service.unclaimed).toBeNull();
    service.capture('?utm_source=google&utm_medium=cpc', '');
    expect(service.unclaimed?.utm_source).toBe('google');
  });

  it('a repeat of the SAME campaign does not re-open the claim', () => {
    service.capture('?utm_source=reddit', '');
    service.markClaimed();
    service.capture('?utm_source=reddit', '');
    expect(service.unclaimed).toBeNull();
  });
});
