import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigService } from './config';
import { RemoteConfigService } from './remote-config.service';

/** ADR-0036: the client renders the server's verdict and FAILS OPEN on every error path. */
describe('RemoteConfigService', () => {
  const configStub = { value: { apiBaseUrl: 'http://core.test' } };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [{ provide: ConfigService, useValue: configStub }],
    });
  });

  afterEach(() => vi.restoreAllMocks());

  function stubFetch(body: unknown): void {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })),
    );
  }

  it('applies the server verdict and per-platform flags', async () => {
    stubFetch({
      platform: 'web',
      update: { required: true, latest_version: '3.1.0', url: null },
      features: { chat: false, friends: true },
    });
    const service = TestBed.inject(RemoteConfigService);
    await service.fetch();
    expect(service.updateRequired()).toBe(true);
    expect(service.latestVersion()).toBe('3.1.0');
    expect(service.isEnabled('chat')).toBe(false);
    expect(service.isEnabled('friends')).toBe(true);
  });

  it('unknown flags read as enabled (fail open)', async () => {
    stubFetch({
      platform: 'web',
      update: { required: false, latest_version: '3.0.0', url: null },
      features: {},
    });
    const service = TestBed.inject(RemoteConfigService);
    await service.fetch();
    expect(service.isEnabled('some-future-feature')).toBe(true);
  });

  it('a failed fetch blocks nothing and disables nothing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))));
    const service = TestBed.inject(RemoteConfigService);
    await service.fetch();
    expect(service.updateRequired()).toBe(false);
    expect(service.isEnabled('chat')).toBe(true);
  });

  it('flags persist to localStorage and reload before the first fetch', async () => {
    stubFetch({
      platform: 'web',
      update: { required: false, latest_version: '3.0.0', url: null },
      features: { chat: false },
    });
    await TestBed.inject(RemoteConfigService).fetch();

    // A fresh injector (new page load) sees the cached flags before any network.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: ConfigService, useValue: configStub }],
    });
    const fresh = TestBed.inject(RemoteConfigService);
    expect(fresh.isEnabled('chat')).toBe(false);
    expect(fresh.updateRequired()).toBe(false); // the update gate never persists — verdicts are live-only
  });
});
