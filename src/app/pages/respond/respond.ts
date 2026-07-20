import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';

/**
 * F-007 P2.1: the landing page for friend-request invite EMAILS. The email's Accept/Decline
 * links point here with `?id=<friendship>&action=accept|decline`; the action fires only on an
 * explicit button press by the signed-in addressee (mail scanners prefetch links, so a GET must
 * never change state), and the server still enforces addressee-only + expiry.
 */
@Component({
  selector: 'app-respond',
  imports: [RouterLink],
  template: `
    <div class="page">
      <header class="top">
        <a routerLink="/driving" class="back" aria-label="Back">←</a>
        <h1>Friend request</h1>
      </header>

      @switch (state()) {
        @case ('confirm') {
          <p class="lead">
            {{ action() === 'accept' ? 'Accept this friend request?' : 'Decline this friend request?' }}
          </p>
          <p class="sub">
            {{
              action() === 'accept'
                ? 'You’ll see the drives they choose to share, and they’ll see yours.'
                : 'The request will be removed. They can send a new one later.'
            }}
          </p>
          <button class="cta" [class.decline]="action() === 'decline'" (click)="confirm()">
            {{ action() === 'accept' ? 'Accept request' : 'Decline request' }}
          </button>
        }
        @case ('working') {
          <p class="lead">Working…</p>
        }
        @case ('done') {
          <p class="lead">
            {{ action() === 'accept' ? 'You’re friends now! 🎉' : 'Request declined.' }}
          </p>
          <a routerLink="/driving" class="cta link">Go to Driving</a>
        }
        @case ('gone') {
          <p class="lead">This request is no longer available.</p>
          <p class="sub">It may have expired, been withdrawn, or already been answered.</p>
          <a routerLink="/driving" class="cta link">Go to Driving</a>
        }
        @case ('invalid') {
          <p class="lead">This link is incomplete.</p>
          <p class="sub">Open your requests instead — they're listed under Driving.</p>
          <a routerLink="/driving" class="cta link">Go to Driving</a>
        }
      }
    </div>
  `,
  styles: [
    `
      .page {
        max-width: 480px;
        margin: 0 auto;
        padding: 18px 16px 64px;
      }
      .top {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
      }
      .back {
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        border: 1px solid var(--border);
        background: var(--surface);
        color: var(--text);
        font-size: 18px;
      }
      h1 {
        font-size: 22px;
        margin: 0;
      }
      .lead {
        font-size: 17px;
        font-weight: 600;
        margin: 0 0 6px;
      }
      .sub {
        color: var(--muted);
        font-size: 14px;
        margin: 0 0 18px;
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
      .cta.decline {
        background: var(--surface);
        color: var(--text);
        border: 1px solid var(--border);
      }
      .cta.link:hover {
        text-decoration: none;
        opacity: 0.9;
      }
    `,
  ],
})
export class Respond {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  readonly action = signal<'accept' | 'decline'>('accept');
  readonly state = signal<'confirm' | 'working' | 'done' | 'gone' | 'invalid'>('confirm');
  private friendshipId = '';

  constructor() {
    const params = this.route.snapshot.queryParamMap;
    this.friendshipId = params.get('id') ?? '';
    const action = params.get('action');
    if (action === 'decline') this.action.set('decline');
    if (!this.friendshipId || (action !== 'accept' && action !== 'decline')) {
      this.state.set('invalid');
    }
  }

  confirm(): void {
    this.state.set('working');
    void this.api
      .respondFriend(this.friendshipId, this.action() === 'accept')
      .then(() => this.state.set('done'))
      .catch(() => this.state.set('gone'));
  }
}
