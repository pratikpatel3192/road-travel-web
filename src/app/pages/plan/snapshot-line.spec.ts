import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SnapshotLine } from './snapshot-line';

const NOW = Date.parse('2026-09-15T12:00:00Z');
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();

/** The dated line over a result opened from its stored snapshot — rendered, so the exact words. */
describe('SnapshotLine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  function render(plannedAt: string, departureAt: string) {
    const fixture = TestBed.createComponent(SnapshotLine);
    fixture.componentRef.setInput('plannedAt', plannedAt);
    fixture.componentRef.setInput('departureAt', departureAt);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const text = () => el.textContent!.replace(/\s+/g, ' ').trim();
    return { fixture, el, text };
  }

  it('says how old the forecast is, with a Refresh', () => {
    const { text } = render(iso(NOW - 3 * HOUR), iso(NOW + 20 * HOUR));
    expect(text()).toBe('Forecast from 3 hours ago · Refresh');
  });

  it.each([
    [60_000, 'Forecast from 1 minute ago · Refresh'],
    [5 * 60_000, 'Forecast from 5 minutes ago · Refresh'],
    [HOUR, 'Forecast from 1 hour ago · Refresh'],
    [24 * HOUR, 'Forecast from 1 day ago · Refresh'],
    [48 * HOUR, 'Forecast from 2 days ago · Refresh'],
  ])('%i ms old: "%s"', (age, expected) => {
    const { text } = render(iso(NOW - age), iso(NOW + 72 * HOUR));
    expect(text()).toBe(expected);
  });

  it('carries the exact time in its tooltip', () => {
    const { el } = render(iso(NOW - 3 * HOUR), iso(NOW + 20 * HOUR));
    const title = el.querySelector('p')!.getAttribute('title')!;
    expect(title).toBe(
      `Forecast fetched ${new Date(NOW - 3 * HOUR).toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })}`,
    );
  });

  it('warns instead once the departure has passed', () => {
    const { el, text } = render(iso(NOW - 20 * HOUR), iso(NOW - HOUR));
    expect(text()).toBe("This trip's departure has passed — Refresh to plan it from now.");
    expect(el.querySelector('p')!.classList).toContain('warn');
  });

  it('turns into the warning by itself when the departure passes while it is on screen', async () => {
    const { fixture, text } = render(iso(NOW - HOUR), iso(NOW + 10 * 60_000));
    expect(text()).toBe('Forecast from 1 hour ago · Refresh');
    await vi.advanceTimersByTimeAsync(11 * 60_000);
    fixture.detectChanges();
    expect(text()).toBe("This trip's departure has passed — Refresh to plan it from now.");
  });

  it('emits refresh from either wording, and not while a plan is in flight', () => {
    const { fixture, el } = render(iso(NOW - HOUR), iso(NOW + HOUR));
    const refresh = vi.fn();
    fixture.componentInstance.refresh.subscribe(refresh);
    el.querySelector('button')!.click();
    expect(refresh).toHaveBeenCalledTimes(1);

    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    expect(el.querySelector('button')!.disabled).toBe(true);

    fixture.componentRef.setInput('busy', false);
    fixture.componentRef.setInput('departureAt', iso(NOW - HOUR));
    fixture.detectChanges();
    el.querySelector('button')!.click();
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
