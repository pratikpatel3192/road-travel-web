import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService, type OAuthProvider } from '../../core/auth.service';

/**
 * Passwordless sign-in (F-002, ADR-0020): Apple, Google, passkey, or email magic-link. Sign-in is
 * offered, not required — the app already runs on a silent anonymous session, and signing in links
 * that session to a real account (upgrade preserves the user_id). When auth isn't configured for the
 * env, the app runs unauthenticated.
 */
@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="login">
      <img class="brand-logo brand-logo-light" src="logo-horizontal-light-2x.png"
           srcset="logo-horizontal-light-2x.png 2x" alt="Road Travel" />
      <img class="brand-logo brand-logo-dark" src="logo-horizontal-dark-2x.png"
           srcset="logo-horizontal-dark-2x.png 2x" alt="Road Travel" />
      <h1>Sign in</h1>
      @if (!auth.configured()) {
        <p class="note">
          Sign-in isn't configured for this environment — you can use the planner directly.
        </p>
        <a routerLink="/app" class="go">Open the planner</a>
      } @else {
        @if (auth.hasRealAccount()) {
          <p class="note">You're signed in{{ auth.email() ? ' as ' + auth.email() : '' }}.</p>
          <a routerLink="/app" class="go">Open the planner</a>
        } @else {
          <p class="note">Sign in to sync your trips and keep Pro across devices — or just
            <a routerLink="/app">keep using the planner</a>.</p>
          <div class="methods">
            <button class="oauth" (click)="oauth('apple')">Continue with Apple</button>
            <button class="oauth" (click)="oauth('google')">Continue with Google</button>
            @if (auth.passkeySupported) {
              <button class="oauth" (click)="passkey()">Continue with a passkey</button>
            }
          </div>
          <div class="or"><span>or</span></div>
          @if (sent()) {
            <p class="note">Check your email for a sign-in link, then return here.</p>
          } @else {
            <form (ngSubmit)="submit()">
              <label> Email
                <input type="email" [(ngModel)]="email" name="email" required placeholder="you@example.com" />
              </label>
              <button type="submit" class="go" [disabled]="loading() || !email">
                {{ loading() ? 'Sending…' : 'Email me a link' }}
              </button>
            </form>
          }
        }
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
      }
    </div>
  `,
  styles: [
    `
      .login {
        max-width: 380px;
        margin: 60px auto;
        padding: 0 16px;
        text-align: center;
      }
      h1 {
        font-size: 22px;
        color: var(--text);
      }
      .methods {
        display: grid;
        gap: 8px;
        margin: 16px 0;
      }
      .oauth {
        padding: 11px;
        border: 1px solid var(--border);
        border-radius: 10px;
        background: var(--surface);
        color: var(--text);
        font-weight: 600;
        cursor: pointer;
      }
      .oauth:hover {
        border-color: var(--accent);
      }
      .or {
        display: flex;
        align-items: center;
        gap: 10px;
        color: var(--muted);
        font-size: 12px;
        margin: 10px 0;
      }
      .or::before,
      .or::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--border);
      }
      form {
        display: grid;
        gap: 12px;
        text-align: left;
      }
      label {
        display: grid;
        gap: 4px;
        font-size: 13px;
        color: var(--muted);
      }
      input {
        padding: 10px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--surface);
        color: var(--text);
        font: inherit;
      }
      .go {
        display: inline-block;
        background: var(--accent);
        color: var(--accent-contrast);
        border: none;
        border-radius: 8px;
        padding: 10px 18px;
        font-weight: 600;
        text-decoration: none;
        cursor: pointer;
      }
      .go[disabled] {
        opacity: 0.6;
        cursor: default;
      }
      .note {
        color: var(--muted);
      }
      .error {
        color: #ef4444;
      }
    `,
  ],
})
export class Login {
  readonly auth = inject(AuthService);
  email = '';
  readonly loading = signal(false);
  readonly sent = signal(false);
  readonly error = signal<string | null>(null);

  async submit(): Promise<void> {
    this.error.set(null);
    this.loading.set(true);
    const { error } = await this.auth.continueWithEmail(this.email);
    this.loading.set(false);
    if (error) this.error.set(error);
    else this.sent.set(true);
  }

  async oauth(provider: OAuthProvider): Promise<void> {
    const { error } = await this.auth.continueWithOAuth(provider);
    if (error) this.error.set(error);
  }

  async passkey(): Promise<void> {
    const { error } = await this.auth.continueWithPasskey();
    if (error) this.error.set(error);
  }
}
