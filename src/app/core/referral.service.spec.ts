import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ReferralService } from './referral.service';

/**
 * ADR-0045: capture `?ref=` and carry it to signup. The client's only jobs are to validate the
 * slug and to be first-touch; the server owns attribution.
 */
describe('ReferralService', () => {
  let service: ReferralService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ReferralService);
  });

  it('captures a valid ref and reads it back', () => {
    expect(service.capture('?ref=jess-miles-from-missouri')).toBe(true);
    expect(localStorage.getItem('rt_ref')).toBe('jess-miles-from-missouri');
    expect(service.slug).toBe('jess-miles-from-missouri');
  });

  it('keeps the FIRST ref — a later creator link never overwrites the original attribution', () => {
    expect(service.capture('?ref=creator-a')).toBe(true);
    // False on the second: "holds a referral" is true forever, "was referred just now" is the
    // countable event, and only the latter fires `referral_captured`.
    expect(service.capture('?ref=creator-b')).toBe(false);
    expect(service.slug).toBe('creator-a');
  });

  it('reports false for a repeat of the SAME ref, so a reload cannot double-count', () => {
    expect(service.capture('?ref=creator-a')).toBe(true);
    expect(service.capture('?ref=creator-a')).toBe(false);
  });

  it('captures alongside the other query params the landing page and planner carry', () => {
    service.capture('?utm_source=reddit&ref=creator-a&from=Austin');
    expect(service.slug).toBe('creator-a');
  });

  it.each([
    ['', 'no query string at all'],
    ['?ref=', 'present but empty'],
    ['?ref=Creator-A', 'uppercase is not case-folded'],
    [`?ref=${'a'.repeat(40)}`, 'over the 32-character cap, and never truncated'],
    ['?ref=creator_a', 'underscore is outside the character class'],
    ['?ref=-creator', 'must start alphanumeric'],
    ['?utm_source=reddit', 'a different parameter entirely'],
  ])('stores nothing for %s (%s)', (search) => {
    expect(service.capture(search)).toBe(false);
    expect(localStorage.getItem('rt_ref')).toBeNull();
    expect(service.slug).toBeNull();
  });

  it('re-validates on read, so a hand-edited value is never sent to the server', () => {
    localStorage.setItem('rt_ref', '../etc/passwd');
    expect(service.slug).toBeNull();
  });

  it('matches the slug the static landing page writes (ADR-0038 duplicates this capture)', () => {
    // The landing page is served by nginx outside Angular and has its own inline copy of this
    // logic. If they ever disagree, a visitor's attribution would depend on which page they hit
    // first — so the key and the pattern are asserted here as the contract between the two.
    const landingPattern = /^[a-z0-9][a-z0-9-]{0,31}$/;
    expect(landingPattern.test('jess-miles-from-missouri')).toBe(true);
    localStorage.setItem('rt_ref', 'jess-miles-from-missouri');
    expect(service.slug).toBe('jess-miles-from-missouri');
  });
});
