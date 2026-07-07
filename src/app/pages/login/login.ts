import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';

/** Magic-link sign-in. When auth isn't configured for the env, the app runs unauthenticated. */
@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="login">
      <h1>Sign in</h1>
      @if (!auth.configured()) {
        <p class="note">
          Sign-in isn't configured for this environment — you can use the planner directly.
        </p>
        <a routerLink="/app" class="go">Open the planner</a>
      } @else if (sent()) {
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
        color: #6b7280;
      }
      input {
        padding: 10px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font: inherit;
      }
      .go {
        display: inline-block;
        background: #111827;
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 10px 18px;
        font-weight: 600;
        text-decoration: none;
        cursor: pointer;
      }
      .note {
        color: #374151;
      }
      .error {
        color: #b91c1c;
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
    const { error } = await this.auth.signInWithEmail(this.email);
    this.loading.set(false);
    if (error) this.error.set(error);
    else this.sent.set(true);
  }
}
