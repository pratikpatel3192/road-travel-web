import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { EntitlementService } from '../../core/entitlement.service';
import { SettingsService, type ThemeMode } from '../../core/settings.service';
import { PlaceField } from '../plan/place-field';
import { ProfileSettings } from './profile-settings';

/** Apple's web subscription manager — for Apple-billed users without their device at hand. */
const APPLE_SUBSCRIPTIONS_URL = 'https://account.apple.com/account/manage';

/** The Settings screen — account, profile, appearance, units, and Home/Work favorites (iOS parity). */
@Component({
  selector: 'app-settings',
  imports: [RouterLink, PlaceField, ProfileSettings],
  template: `
    <div class="page">
      <header class="top">
        <a routerLink="/app" class="back" aria-label="Back">←</a>
        <h1>Settings</h1>
      </header>

      @if (auth.configured()) {
        <section class="card">
          <h2>Account</h2>
          @if (auth.hasRealAccount()) {
            <div class="acct">
              <div class="acct-who">
                <p class="acct-email">{{ auth.email() }}</p>
                <p class="acct-note">Your profile, trips, and Pro follow this account.</p>
              </div>
              <button type="button" class="acct-btn" (click)="auth.signOut()">Sign out</button>
            </div>
            <!-- ADR-0028: route by WHERE the subscription is billed (server field), never by
                 platform. Hidden for promo/dev (management 'none') and non-subscribers. -->
            @if (manageable(); as sub) {
              <div class="manage-row">
                <div class="acct-who">
                  <p class="manage-title">Subscription</p>
                  <p class="acct-note">
                    {{ sub.management === 'apple' ? 'Billed through Apple.' : 'Billed through our website.' }}
                    @if (sub.will_renew === false) { Won't renew. }
                  </p>
                </div>
                <button
                  type="button"
                  class="acct-btn"
                  [disabled]="portalLoading()"
                  (click)="manageSubscription()"
                >
                  {{ portalLoading() ? 'Opening…' : 'Manage subscription' }}
                </button>
              </div>
              @if (manageError()) {
                <p class="manage-error" role="alert">{{ manageError() }}</p>
              }
            }
          } @else {
            <!-- Guests run on a silent anonymous session — say so, and say what signing in adds. -->
            <p class="acct-note">
              You're browsing as a guest. Sign in to unlock your profile, personalization, and Pro
              across your devices.
            </p>
            <a routerLink="/login" class="acct-btn acct-cta">Sign in</a>
          }
        </section>
      }

      <app-profile-settings />

      <section class="card">
        <h2>Appearance</h2>
        <div class="seg" role="group" aria-label="Appearance">
          @for (t of themes; track t.value) {
            <button
              type="button"
              [class.on]="settings.theme() === t.value"
              (click)="settings.setTheme(t.value)"
            >
              {{ t.label }}
            </button>
          }
        </div>
      </section>

      <section class="card">
        <h2>Units</h2>
        <div class="seg" role="group" aria-label="Units">
          <button type="button" [class.on]="settings.units() === 'imperial'" (click)="settings.setUnits('imperial')">
            Miles · °F
          </button>
          <button type="button" [class.on]="settings.units() === 'metric'" (click)="settings.setUnits('metric')">
            Kilometers · °C
          </button>
        </div>
      </section>

      <section class="card">
        <h2>Favorites</h2>
        <label class="fav-label">Home</label>
        <div class="fav-field">
          <app-place-field
            kind="origin"
            placeholder="Search a place"
            [place]="settings.home()"
            (placeChange)="settings.setHome($event)"
          />
        </div>
        <label class="fav-label">Work</label>
        <div class="fav-field">
          <app-place-field
            kind="destination"
            placeholder="Search a place"
            [place]="settings.work()"
            (placeChange)="settings.setWork($event)"
          />
        </div>
      </section>

      <section class="card links">
        <a routerLink="/privacy">Privacy Policy</a>
        <a routerLink="/support">Support</a>
      </section>

      <!-- Apple-billed subscription: it can only be cancelled/changed through Apple, so explain
           where billing lives instead of failing (ADR-0028 "never cross the streams"). -->
      @if (appleModal()) {
        <div class="modal-backdrop" (click)="appleModal.set(false)">
          <div class="modal" role="dialog" aria-modal="true" aria-labelledby="apple-manage-title"
               (click)="$event.stopPropagation()">
            <h3 id="apple-manage-title">Billed through Apple</h3>
            <p>
              Your subscription is billed through Apple. To cancel or change your plan, open the
              Road Travel app on your iPhone and go to <strong>Settings → Manage subscription</strong>.
            </p>
            <p class="modal-alt">
              Don't have your device handy? You can also manage it from
              <a [href]="appleSubscriptionsUrl" target="_blank" rel="noopener">your Apple account</a>
              under Subscriptions.
            </p>
            <button type="button" class="acct-btn modal-close" (click)="appleModal.set(false)">
              Done
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .page {
        max-width: 560px;
        margin: 0 auto;
        padding: 18px 16px 64px;
      }
      .top {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
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
      .back:hover {
        text-decoration: none;
      }
      h1 {
        font-size: 22px;
        margin: 0;
      }
      .card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 14px 16px;
        margin-bottom: 14px;
      }
      h2 {
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--muted);
        margin: 0 0 10px;
      }
      .seg {
        display: flex;
        gap: 6px;
        background: var(--surface-2);
        border-radius: 10px;
        padding: 4px;
      }
      .seg button {
        flex: 1;
        padding: 9px 8px;
        border: none;
        background: transparent;
        color: var(--text);
        font: inherit;
        font-size: 14px;
        border-radius: 8px;
        cursor: pointer;
      }
      .seg button.on {
        background: var(--accent);
        color: var(--accent-contrast);
        font-weight: 600;
      }
      .links {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .fav-label {
        display: block;
        font-size: 13px;
        color: var(--text);
        font-weight: 600;
        margin: 6px 0 2px;
      }
      .fav-field {
        border: 1px solid var(--border);
        border-radius: 10px;
        background: var(--surface-2);
      }
      .fav-field + .fav-label {
        margin-top: 12px;
      }
      .acct {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .acct-who {
        flex: 1;
        min-width: 0;
      }
      .acct-email {
        margin: 0;
        font-weight: 600;
        font-size: 14px;
        color: var(--text);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .acct-note {
        margin: 2px 0 0;
        font-size: 13px;
        color: var(--muted);
      }
      .acct-btn {
        flex-shrink: 0;
        padding: 8px 14px;
        border: 1px solid var(--border);
        border-radius: 10px;
        background: var(--surface-2);
        color: var(--text);
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        text-decoration: none;
      }
      .acct-btn:hover {
        border-color: var(--accent);
      }
      .acct-cta {
        display: inline-block;
        margin-top: 10px;
        background: var(--accent);
        color: var(--accent-contrast);
        border-color: var(--accent);
      }
      .manage-row {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid var(--border);
      }
      .manage-title {
        margin: 0;
        font-weight: 600;
        font-size: 14px;
        color: var(--text);
      }
      .manage-error {
        margin: 8px 0 0;
        font-size: 13px;
        color: #ef4444;
      }
      .modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1000;
        background: rgba(0, 0, 0, 0.45);
        display: grid;
        place-items: center;
        padding: 16px;
      }
      .modal {
        max-width: 420px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 20px;
      }
      .modal h3 {
        margin: 0 0 8px;
        font-size: 17px;
        color: var(--text);
      }
      .modal p {
        margin: 0 0 10px;
        font-size: 14px;
        color: var(--text);
      }
      .modal-alt {
        color: var(--muted);
      }
      .modal-close {
        margin-top: 6px;
      }
    `,
  ],
})
export class Settings {
  readonly auth = inject(AuthService);
  readonly settings = inject(SettingsService);
  private readonly api = inject(ApiService);
  private readonly entitlement = inject(EntitlementService);

  readonly appleSubscriptionsUrl = APPLE_SUBSCRIPTIONS_URL;
  readonly appleModal = signal(false);
  readonly portalLoading = signal(false);
  readonly manageError = signal<string | null>(null);
  /** The manage entry shows only for a routable subscription (apple/stripe — never promo/dev). */
  readonly manageable = computed(() => {
    const sub = this.entitlement.subscription();
    return sub && (sub.management === 'apple' || sub.management === 'stripe') ? sub : null;
  });

  readonly themes: { value: ThemeMode; label: string }[] = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  constructor() {
    // The subscription routing lives on /v1/me — make sure it's fresh when Settings opens.
    void this.entitlement.refresh();
  }

  async manageSubscription(): Promise<void> {
    const sub = this.manageable();
    if (!sub) return;
    if (sub.management === 'apple') {
      this.appleModal.set(true);
      return;
    }
    // Stripe: the server mints a Billing Portal session (return_url is server-derived).
    this.manageError.set(null);
    this.portalLoading.set(true);
    try {
      const { url } = await this.api.createPortalSession();
      window.location.href = url;
    } catch {
      this.portalLoading.set(false);
      this.manageError.set("Couldn't open subscription management. Please try again.");
    }
  }
}
