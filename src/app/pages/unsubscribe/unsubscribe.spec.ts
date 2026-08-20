import { convertToParamMap, ActivatedRoute } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EmailPrefsService, InvalidUnsubscribeLinkError } from '../../core/email-prefs.service';
import { Unsubscribe } from './unsubscribe';

/**
 * The invariant this page exists to keep: opening it must not opt anybody out — mail scanners
 * fetch every link in a message — so only an explicit press calls the mutating endpoint.
 */
describe('Unsubscribe page', () => {
  const prefs = {
    read: vi.fn(),
    unsubscribe: vi.fn(),
    resubscribe: vi.fn(),
  };

  function build(token: string | null): Unsubscribe {
    TestBed.configureTestingModule({
      providers: [
        { provide: EmailPrefsService, useValue: prefs },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(token ? { token } : {}) } },
        },
      ],
    });
    return TestBed.runInInjectionContext(() => new Unsubscribe());
  }

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
    history.replaceState(null, '', '/unsubscribe?token=abc');
  });

  it('reads the link but never unsubscribes on load', async () => {
    prefs.read.mockResolvedValue({
      email_masked: 'b•••@x.com',
      list_key: 'marketing',
      subscribed: true,
    });

    const page = build('tok-123');
    await vi.waitFor(() => expect(page.state()).toBe('confirm'));

    expect(prefs.read).toHaveBeenCalledWith('tok-123');
    expect(prefs.unsubscribe).not.toHaveBeenCalled();
    expect(page.email()).toBe('b•••@x.com');
  });

  it('drops the token from the address bar, keeping it out of history and referrers', async () => {
    prefs.read.mockResolvedValue({
      email_masked: 'b•••@x.com',
      list_key: 'marketing',
      subscribed: true,
    });

    build('tok-123');

    expect(location.search).toBe('');
    expect(location.pathname).toBe('/unsubscribe');
  });

  it('opts out on an explicit press and offers the way back', async () => {
    prefs.read.mockResolvedValue({
      email_masked: 'b•••@x.com',
      list_key: 'marketing',
      subscribed: true,
    });
    prefs.unsubscribe.mockResolvedValue({
      email_masked: 'b•••@x.com',
      list_key: 'marketing',
      subscribed: false,
    });
    prefs.resubscribe.mockResolvedValue({
      email_masked: 'b•••@x.com',
      list_key: 'marketing',
      subscribed: true,
    });

    const page = build('tok-123');
    await vi.waitFor(() => expect(page.state()).toBe('confirm'));

    await page.unsubscribe();
    expect(prefs.unsubscribe).toHaveBeenCalledWith('tok-123');
    expect(page.state()).toBe('done');

    await page.resubscribe();
    expect(page.state()).toBe('resubscribed');
  });

  it('says so when the address is already suppressed instead of offering to opt out again', async () => {
    prefs.read.mockResolvedValue({
      email_masked: 'b•••@x.com',
      list_key: 'marketing',
      subscribed: false,
    });

    const page = build('tok-123');
    await vi.waitFor(() => expect(page.state()).toBe('done'));
  });

  it('separates a broken link from a broken server — only one of them is the user’s problem', async () => {
    prefs.read.mockRejectedValue(new InvalidUnsubscribeLinkError('invalid_token'));
    const bad = build('tampered');
    await vi.waitFor(() => expect(bad.state()).toBe('invalid'));

    TestBed.resetTestingModule();
    prefs.read.mockRejectedValue(new Error('offline'));
    const offline = build('tok-123');
    await vi.waitFor(() => expect(offline.state()).toBe('error'));
  });

  it('treats a link with no token at all as invalid, without calling the server', () => {
    const page = build(null);
    expect(page.state()).toBe('invalid');
    expect(prefs.read).not.toHaveBeenCalled();
  });
});
