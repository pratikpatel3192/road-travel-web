import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

/**
 * Where Stripe Checkout sends an iOS buyer back to (core sets this as `success_url`/`cancel_url`
 * when the caller declares `X-Platform: ios`).
 *
 * **Why this page exists rather than a plain Universal Link.** Stripe only accepts an `https`
 * `success_url`, so the app's custom scheme cannot go there directly. An `https` Universal Link
 * would be the tidy answer, except Apple does not reliably open the app when the link is reached by
 * a **server-side redirect** — which is exactly how Checkout returns. So this page loads in Safari
 * and bounces to the custom scheme, which *does* work reliably from a web page. The button is the
 * fallback for when the automatic bounce is blocked (Safari suppresses scheme navigation that isn't
 * user-initiated in some versions) or the app is not installed.
 *
 * The page deliberately claims nothing about entitlement. Pro is granted by the signed Stripe
 * webhook, not by arriving here — a `status=success` in a URL anyone can type is not evidence of
 * payment, and telling someone they are Pro before the webhook lands would be a lie we would then
 * have to take back.
 */
@Component({
  selector: 'app-checkout-return',
  imports: [RouterLink],
  template: `
    <main class="wrap">
      @if (cancelled()) {
        <h1>Checkout cancelled</h1>
        <p>Nothing was charged. You can pick a plan again whenever you like.</p>
      } @else {
        <h1>Thanks — you're all set</h1>
        <p>
          Your subscription is being confirmed. Head back to Road Travel; Pro appears as soon as
          the payment clears, usually within a few seconds.
        </p>
      }

      <div class="row">
        <a class="btn" [href]="appLink()">Return to Road Travel</a>
        <a class="btn ghost" routerLink="/plan">Continue in this browser</a>
      </div>
    </main>
  `,
  styles: [
    `
      .wrap {
        max-width: 520px;
        margin: 0 auto;
        padding: 72px 20px 96px;
        text-align: center;
      }
      h1 {
        font-size: 26px;
        margin: 0 0 10px;
      }
      p {
        color: var(--muted);
        margin: 0 0 26px;
      }
      .row {
        display: flex;
        gap: 12px;
        justify-content: center;
        flex-wrap: wrap;
      }
      .btn {
        background: var(--accent);
        color: var(--accent-contrast);
        border-radius: 10px;
        padding: 12px 22px;
        font-weight: 600;
        text-decoration: none;
      }
      .btn.ghost {
        background: var(--surface);
        color: var(--text);
        border: 1px solid var(--border);
      }
      .btn:hover {
        text-decoration: none;
      }
    `,
  ],
})
export class CheckoutReturn {
  private readonly route = inject(ActivatedRoute);

  /** Only ever 'success' or 'cancel'; anything else is treated as success-shaped but says nothing. */
  private readonly status = signal(this.route.snapshot.queryParamMap.get('status') ?? '');

  readonly cancelled = computed(() => this.status() === 'cancel');

  /** The scheme is registered in the app's Info.plist (CFBundleURLSchemes: roadtravel). */
  readonly appLink = computed(() =>
    this.cancelled() ? 'roadtravel://checkout?status=cancel' : 'roadtravel://checkout?status=success',
  );

  constructor() {
    // Bounce straight into the app. Wrapped because a blocked scheme navigation throws in some
    // browsers, and a thrown error here would blank the page and strip the manual fallback — the
    // one thing that still works when the automatic hop does not.
    try {
      window.location.href = this.appLink();
    } catch {
      /* the button below is the fallback */
    }
  }
}
