import { Injectable, inject } from '@angular/core';

import { ConfigService } from './config';

/** What `/v1/email/preferences` (and both mutations) answer with. */
export interface EmailPreferences {
  /** The recipient address, masked server-side (`b•••@example.com`) — never the full address. */
  email_masked: string;
  /** Which list the link is for. `marketing` today. */
  list_key: string;
  subscribed: boolean;
}

/** The link was never valid, has been tampered with, or this env has no signing key. */
export class InvalidUnsubscribeLinkError extends Error {}

/**
 * Marketing email preferences behind an unsubscribe link.
 *
 * Hand-written `fetch` rather than {@link ApiService} / the generated SDK, deliberately: these are
 * the only PUBLIC endpoints the web app calls. ApiService attaches the Supabase bearer token and
 * the device id to every request, and the unsubscribe page must work for someone who is signed
 * out, whose account is gone, or who never had one — the signed token in the link IS the
 * authorization. (When the SDK is next regenerated from core's OpenAPI these endpoints will
 * appear in it; the token-only, session-free calling convention here still applies.)
 */
@Injectable({ providedIn: 'root' })
export class EmailPrefsService {
  private readonly config = inject(ConfigService);

  /** Read the current state. Never changes anything — the server keeps mutations on POST. */
  read(token: string): Promise<EmailPreferences> {
    return this.call('GET', 'preferences', token);
  }

  /** Opt out. Idempotent — clicking twice is not an error. */
  unsubscribe(token: string): Promise<EmailPreferences> {
    return this.call('POST', 'unsubscribe', token);
  }

  /** Undo an opt-out from the same link ("that was a mistake"). */
  resubscribe(token: string): Promise<EmailPreferences> {
    return this.call('POST', 'resubscribe', token);
  }

  private async call(
    method: 'GET' | 'POST',
    path: string,
    token: string,
  ): Promise<EmailPreferences> {
    const base = this.config.value.apiBaseUrl.replace(/\/$/, '');
    const url = `${base}/v1/email/${path}?token=${encodeURIComponent(token)}`;
    const response = await fetch(url, { method });
    if (response.status === 400) throw new InvalidUnsubscribeLinkError('invalid_token');
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return (await response.json()) as EmailPreferences;
  }
}
