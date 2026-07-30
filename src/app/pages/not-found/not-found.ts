import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * ADR-0038: the route table used to end in `{ path: '**', redirectTo: '' }`, which answered every
 * mistyped URL with HTTP 200 and the planner — a soft-404 farm as far as a crawler is concerned.
 *
 * This component is the in-app half of the fix; the other half — the half crawlers see — is nginx,
 * which now returns a real HTTP 404 with `public/404.html` for anything outside the known-route
 * allowlist (`docker/nginx.conf.template`). So this component only renders for a bad path reached by
 * an IN-APP navigation, which no crawler performs; its job is purely to keep a mistyped in-app link
 * from throwing NG04002 and blanking the app.
 */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <main class="wrap">
      <h1>That page doesn't exist.</h1>
      <p>The link may be broken or the page may have moved. You can still plan a drive.</p>
      <div class="row">
        <a class="btn" routerLink="/plan">Plan a drive</a>
        <a class="btn ghost" href="/">Back to the home page</a>
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
export class NotFound {}
