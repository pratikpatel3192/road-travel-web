import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { EmailPrefsService, InvalidUnsubscribeLinkError } from '../../core/email-prefs.service';

type State = 'loading' | 'confirm' | 'working' | 'done' | 'resubscribed' | 'invalid' | 'error';

/**
 * The landing page for the "unsubscribe" link in marketing email.
 *
 * PUBLIC — no guard, and none of the app's session machinery. The person clicking may be signed
 * out, may have deleted their account, and may never have had one (marketing also goes to
 * waitlist and outreach addresses); the signed token in the link is the authorization, and the
 * server keeps the record on the EMAIL, not the account.
 *
 * Opting out takes an explicit button press. Mail scanners and link-preview bots fetch every URL
 * in a message, so if merely opening this page unsubscribed you, people would be opted out at
 * random by their own mail client — the same reason the friend-invite links land on a confirm
 * page (see `pages/respond`). Real one-click unsubscribes bypass this page entirely: the mailbox
 * provider POSTs core's RFC 8058 endpoint directly.
 */
@Component({
  selector: 'app-unsubscribe',
  template: `
    <main class="wrap">
      <h1>Email preferences</h1>

      @switch (state()) {
        @case ('loading') {
          <p class="lead">Checking this link…</p>
        }
        @case ('confirm') {
          <p class="lead">Stop sending Road Travel news to {{ email() }}?</p>
          <p class="sub">
            You'll still get essential account email — trip receipts, sign-in links, and friend
            requests. Those aren't marketing, so they don't stop.
          </p>
          <button class="cta" (click)="unsubscribe()">Unsubscribe</button>
        }
        @case ('working') {
          <p class="lead">Saving…</p>
        }
        @case ('done') {
          <p class="lead">You're unsubscribed.</p>
          <p class="sub">
            We won't send marketing email to {{ email() }} again. Changed your mind?
          </p>
          <button class="cta ghost" (click)="resubscribe()">Resubscribe</button>
        }
        @case ('resubscribed') {
          <p class="lead">You're back on the list.</p>
          <p class="sub">{{ email() }} will receive Road Travel news again.</p>
          <button class="cta ghost" (click)="unsubscribe()">Unsubscribe</button>
        }
        @case ('invalid') {
          <p class="lead">This link isn't valid.</p>
          <p class="sub">
            It may have been altered in transit or truncated by your mail client. Open the link from
            the original email, or turn marketing email off in Settings → Profile.
          </p>
          <a class="cta ghost" href="/settings">Go to Settings</a>
        }
        @case ('error') {
          <p class="lead">Something went wrong.</p>
          <p class="sub">We couldn't reach the server. Try the link again in a moment.</p>
          <button class="cta ghost" (click)="reload()">Try again</button>
        }
      }
    </main>
  `,
  styles: [
    `
      .wrap {
        max-width: 520px;
        margin: 0 auto;
        padding: 56px 20px 96px;
      }
      h1 {
        font-size: 22px;
        margin: 0 0 18px;
      }
      .lead {
        font-size: 17px;
        font-weight: 600;
        margin: 0 0 8px;
      }
      .sub {
        color: var(--muted);
        font-size: 14px;
        line-height: 1.5;
        margin: 0 0 20px;
      }
      .cta {
        display: inline-block;
        padding: 12px 22px;
        border: none;
        border-radius: var(--radius);
        background: var(--accent);
        color: var(--accent-contrast);
        font: inherit;
        font-weight: 600;
        cursor: pointer;
        text-decoration: none;
      }
      .cta.ghost {
        background: var(--surface);
        color: var(--text);
        border: 1px solid var(--border);
      }
    `,
  ],
})
export class Unsubscribe {
  private readonly prefs = inject(EmailPrefsService);
  private readonly route = inject(ActivatedRoute);

  readonly state = signal<State>('loading');
  readonly email = signal('your address');
  private token = '';

  constructor() {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.state.set('invalid');
      return;
    }
    // Drop the token from the address bar before anything else can carry it away: it would
    // otherwise sit in browser history and ride along in the Referer of any later navigation.
    // The copy in `this.token` is what the page actually uses (same trick AuthService plays with
    // magic-link tokens).
    history.replaceState(null, '', location.pathname);
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const prefs = await this.prefs.read(this.token);
      this.email.set(prefs.email_masked);
      // Already opted out (a second visit, or the mailbox provider's one-click got there first):
      // say so instead of offering to unsubscribe again.
      this.state.set(prefs.subscribed ? 'confirm' : 'done');
    } catch (err) {
      this.fail(err);
    }
  }

  async unsubscribe(): Promise<void> {
    this.state.set('working');
    try {
      this.email.set((await this.prefs.unsubscribe(this.token)).email_masked);
      this.state.set('done');
    } catch (err) {
      this.fail(err);
    }
  }

  async resubscribe(): Promise<void> {
    this.state.set('working');
    try {
      this.email.set((await this.prefs.resubscribe(this.token)).email_masked);
      this.state.set('resubscribed');
    } catch (err) {
      this.fail(err);
    }
  }

  reload(): void {
    this.state.set('loading');
    void this.load();
  }

  private fail(err: unknown): void {
    this.state.set(err instanceof InvalidUnsubscribeLinkError ? 'invalid' : 'error');
  }
}
