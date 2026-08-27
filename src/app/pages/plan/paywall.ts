import { Component, computed, effect, inject, signal } from '@angular/core';
import type { PlanOption } from '@road-travel/sdk';

import { AnalyticsService } from '../../core/analytics.service';
import { ApiService } from '../../core/api.service';
import { AuthService, type OAuthProvider } from '../../core/auth.service';
import { EntitlementService } from '../../core/entitlement.service';
import { PaywallService } from '../../core/paywall.service';

/**
 * The subscribe paywall modal (ADR-0044). Rendered app-wide; appears when a 402
 * (`subscription_required`) hands a `PaywallResponse` to PaywallService. It renders the server
 * payload verbatim — plans (annual-default first, monthly second) and the reason message — and
 * starts **Stripe Checkout** for a plain subscription with NO trial. The 7-day trial now belongs to
 * our database and is granted at signup, so anyone seeing this modal has already spent theirs, and
 * `is_pro` only flips via the signed Stripe webhook. Checkout needs a real account, so an anonymous
 * user is offered passwordless sign-in inline first.
 */
@Component({
  selector: 'app-paywall',
  template: `
    @if (pw.payload(); as p) {
      <div class="overlay" (click)="dismiss()">
        <div class="sheet" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <button class="close" (click)="dismiss()" aria-label="Close">✕</button>
                <img class="brand-logo brand-logo-light" src="logo-horizontal-light-2x.png"
           srcset="logo-horizontal-light-2x.png 2x" alt="Road Travel" />
      <img class="brand-logo brand-logo-dark" src="logo-horizontal-dark-2x.png"
           srcset="logo-horizontal-dark-2x.png 2x" alt="Road Travel" />
          <h2>Go Pro</h2>
          <p class="msg">{{ p.message }}</p>

          <ul class="benefits">
            <li>Weather timed to your exact arrival</li>
            <li>Weather-ahead alerts as you drive</li>
            <li>Multi-stop trips, planned stop by stop</li>
            <li>Scenic spots, food &amp; fuel along the way</li>
            <li>Plain-language AI trip briefings</li>
            <li>Plan future departures &amp; compare times</li>
            <li>Save &amp; sync your trips across devices</li>
          </ul>

          <div class="plans">
            @for (plan of p.plans; track plan.product_id) {
              <button
                class="plan"
                [class.hero]="plan.is_default"
                [class.sel]="selected() === plan.product_id"
                (click)="select(plan)"
              >
                @if (plan.is_default) {
                  <span class="badge">Best value</span>
                }
                <span class="period">{{ plan.period === 'annual' ? 'Annual' : 'Monthly' }}</span>
                <span class="price">{{ plan.price }}</span>
              </button>
            }
          </div>

          @if (!auth.configured()) {
            <p class="hint">Subscriptions aren't set up in this environment yet.</p>
          } @else if (!auth.hasRealAccount()) {
            <p class="hint">Sign in to start your subscription — it keeps Pro across your devices.</p>
            <div class="auth">
              <button class="oauth" (click)="oauth('apple')"> Continue with Apple</button>
              <button class="oauth google" (click)="oauth('google')">Continue with Google</button>
              @if (auth.passkeySupported) {
                <button class="oauth" (click)="passkey()">Continue with a passkey</button>
              }
              <div class="email">
                <input
                  type="email"
                  [value]="email()"
                  (input)="email.set($any($event.target).value)"
                  (keyup.enter)="emailLink()"
                  placeholder="you@example.com"
                  aria-label="Email"
                />
                <button type="button" (click)="emailLink()" [disabled]="!email()">Email me a link</button>
              </div>
            </div>
          } @else {
            <button class="cta" (click)="subscribe()" [disabled]="busy() || !selected()">
              {{ busy() ? 'Starting…' : ctaLabel() }}
            </button>
          }

          @if (status()) {
            <p class="status" [class.err]="isError()" role="status">{{ status() }}</p>
          }
          <button class="later" (click)="dismiss()">Maybe later</button>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .overlay {
        position: fixed;
        inset: 0;
        z-index: 100;
        background: rgba(0, 0, 0, 0.5);
        display: grid;
        place-items: center;
        padding: 16px;
      }
      .sheet {
        position: relative;
        width: 100%;
        max-width: 400px;
        background: var(--surface);
        color: var(--text);
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 22px 20px;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3);
      }
      .close {
        position: absolute;
        top: 12px;
        right: 12px;
        border: none;
        background: none;
        font-size: 16px;
        cursor: pointer;
        color: var(--text);
      }
      h2 {
        margin: 0 0 6px;
        font-size: 22px;
      }
      .msg {
        margin: 0 0 16px;
        color: var(--muted);
        font-size: 14px;
      }
      .benefits {
        list-style: none;
        margin: 0 0 18px;
        padding: 0;
        display: grid;
        gap: 9px;
      }
      .benefits li {
        position: relative;
        padding-left: 26px;
        font-size: 14px;
        color: var(--text);
        line-height: 1.35;
      }
      .benefits li::before {
        content: '✓';
        position: absolute;
        left: 0;
        top: 0;
        color: var(--accent);
        font-weight: 800;
      }
      .plans {
        display: grid;
        gap: 10px;
        margin-bottom: 14px;
      }
      .plan {
        position: relative;
        display: grid;
        gap: 2px;
        text-align: left;
        padding: 14px 16px;
        border: 2px solid var(--border);
        border-radius: 14px;
        background: var(--surface);
        color: inherit;
        cursor: pointer;
      }
      /* "Best value" emphasis, NOT selection. This used to be var(--accent), the same colour
         selection uses, so the default plan looked permanently selected: picking Monthly left
         Annual still ringed in accent and both read as chosen. Worse, nothing is selected on
         open, so Annual looked picked while Subscribe sat disabled. The badge already says
         "Best value"; the border only needs to lift it off the other card. */
      .plan.hero {
        border-color: var(--border-strong);
      }
      /* Accent now means exactly one thing: this is the plan you have selected. */
      .plan.sel {
        border-color: var(--accent);
        outline: 2px solid var(--accent);
        outline-offset: 1px;
      }
      .badge {
        position: absolute;
        top: -10px;
        right: 12px;
        background: var(--accent);
        color: var(--accent-contrast);
        font-size: 11px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 999px;
      }
      .period {
        font-weight: 700;
        font-size: 15px;
      }
      .price {
        font-size: 18px;
      }
      .cta {
        width: 100%;
        background: var(--accent);
        color: var(--accent-contrast);
        border: none;
        border-radius: 12px;
        padding: 13px;
        font-weight: 700;
        font-size: 15px;
        cursor: pointer;
      }
      .cta:disabled {
        opacity: 0.6;
        cursor: default;
      }
      .auth {
        display: grid;
        gap: 8px;
      }
      .oauth {
        padding: 11px;
        border: 1px solid var(--border);
        border-radius: 10px;
        background: var(--surface);
        color: inherit;
        font-weight: 600;
        cursor: pointer;
      }
      .email {
        display: flex;
        gap: 6px;
      }
      .email input {
        flex: 1;
        padding: 10px;
        border: 1px solid var(--border);
        border-radius: 10px;
        font: inherit;
      }
      .email button {
        padding: 0 12px;
        border: 1px solid var(--border);
        border-radius: 10px;
        background: var(--surface);
        color: inherit;
        cursor: pointer;
      }
      .hint {
        font-size: 13px;
        color: var(--muted);
        margin: 0 0 10px;
      }
      .status {
        font-size: 13px;
        margin: 10px 0 0;
        color: var(--muted);
      }
      .status.err {
        color: #b91c1c;
      }
      .later {
        display: block;
        margin: 12px auto 0;
        background: none;
        border: none;
        color: var(--muted);
        cursor: pointer;
        font-size: 13px;
      }
    `,
  ],
})
export class Paywall {
  readonly pw = inject(PaywallService);
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly entitlement = inject(EntitlementService);
  private readonly analytics = inject(AnalyticsService);

  readonly selected = signal<string | null>(null);
  readonly busy = signal(false);
  readonly status = signal<string | null>(null);
  readonly isError = signal(false);
  readonly email = signal('');

  /**
   * ADR-0044: there is no trial to offer here. The server grants one at signup and it is spent by
   * the time this modal appears — that expiry is what produced the 402. `trial_days` is 0 on every
   * plan for the same reason, so the CTA is unconditionally "Subscribe".
   */

  readonly ctaLabel = computed(() => {
    const plan = this.pw.payload()?.plans.find((x) => x.product_id === this.selected());
    return 'Subscribe';
  });

  constructor() {
    // ADR-0037 `paywall_viewed` — parity with the iOS PaywallView `.task`. This component is mounted
    // app-wide and only RENDERS when a payload arrives, so the null -> payload transition is the
    // view. Guarded so re-renders (entitlement refresh, plan selection) don't double-count, and
    // re-armed on dismiss so the next 402 counts again.
    let counted = false;
    effect(() => {
      const payload = this.pw.payload();
      if (!payload) {
        counted = false;
        return;
      }
      if (counted) return;
      counted = true;
      // The server's coarse reason code, exactly what iOS passes as `trigger`.
      this.analytics.capture('paywall_viewed', { trigger: payload.reason });
    });

    // Pre-select a plan, matching iOS (`PaywallView` sets `selected = packages.first` in its
    // `.task`). Web started with nothing selected while the default plan was styled as though it
    // were, so Subscribe sat disabled with no visible reason. Prefer the server's default plan,
    // fall back to the first. Only ever sets a selection when there is none, so it cannot stomp
    // the user's choice on an unrelated re-render.
    effect(() => {
      const payload = this.pw.payload();
      if (!payload) {
        this.selected.set(null);
        return;
      }
      if (this.selected() !== null) return;
      const plan = payload.plans.find((x) => x.is_default) ?? payload.plans[0];
      if (plan) this.selected.set(plan.product_id);
    });
  }

  select(plan: PlanOption): void {
    this.selected.set(plan.product_id);
  }

  private setStatus(msg: string, error = false): void {
    this.status.set(msg);
    this.isError.set(error);
  }

  async subscribe(): Promise<void> {
    const plan = this.pw.payload()?.plans.find((x) => x.product_id === this.selected());
    if (!plan) return;
    this.busy.set(true);
    this.setStatus('');
    try {
      // ADR-0044: a plain subscription, no trial. The session carries no `trial_period_days` —
      // the server trial is spent by now, and a store-side one would be a second, overlapping
      // trial. `is_pro` only flips via the signed webhook once Stripe confirms. We leave the SPA
      // here, so no need to clear `busy`.
      const session = await this.api.createCheckoutSession(plan.period);
      window.location.href = session.url;
    } catch (e) {
      this.setStatus((e as Error).message ?? 'Could not start checkout.', true);
      this.busy.set(false);
    }
  }

  async oauth(provider: OAuthProvider): Promise<void> {
    const { error } = await this.auth.continueWithOAuth(provider);
    if (error) this.setStatus(error, true);
  }

  async passkey(): Promise<void> {
    const { error } = await this.auth.continueWithPasskey();
    if (error) this.setStatus(error, true);
    else await this.entitlement.refresh();
  }

  async emailLink(): Promise<void> {
    if (!this.email()) return;
    const { error } = await this.auth.continueWithEmail(this.email());
    this.setStatus(error ?? 'Check your email for a sign-in link, then return here.', !!error);
  }

  dismiss(): void {
    this.pw.dismiss();
  }
}
