import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Marketing landing — design 6a hero (docs/DESIGN_SYSTEM.md §Components; reference
 * branding/web-kit-6a.html §2): wordmark + "Weather along your route", gradient panel, primary
 * "Get the app" + secondary "Open web app" CTAs, and the kit's animated route/pin vector. The
 * kit's med-* weather icons are NOT yet in branding/ (follow-up in T-015), so the art ships the
 * in-kit SVG shapes only. All colors come from tokens; the vector strokes swap by theme.
 */
@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <div class="wrap">
      <section class="hero">
        <div class="copy">
          <h1>Road Travel</h1>
          <p class="tagline">Weather along your route</p>
          <div class="ctas">
            <a class="btn-primary" href="https://apps.apple.com/app/id6785563236">Get the app</a>
            <a class="btn-secondary" routerLink="/app">Open web app</a>
          </div>
        </div>
        <svg class="art" viewBox="0 0 512 512" aria-hidden="true">
          <polyline
            class="road"
            points="78,456 146,394 300,352 272,214 392,150 444,112"
            fill="none"
            stroke-width="26"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-dasharray="600"
          />
          <polyline
            class="dashes"
            points="78,456 146,394 300,352 272,214 392,150 444,112"
            fill="none"
            stroke-width="4.5"
            stroke-dasharray="17 15"
            stroke-linecap="round"
          />
          <circle class="ring" cx="58" cy="470" r="16" fill="none" stroke-width="10" />
          <g class="pin">
            <ellipse cx="416" cy="116" rx="20" ry="6" fill="#16304F" opacity="0.28" />
            <path
              d="M416 13 C390 13 371 32 371 56 C371 82 416 118 416 118 C416 118 461 82 461 56 C461 32 442 13 416 13 Z"
              fill="url(#rt-pin-red)"
            />
            <ellipse cx="401" cy="30" rx="18" ry="10" fill="#FFFFFF" opacity="0.32" />
            <circle cx="416" cy="54" r="17" fill="url(#rt-pin-face)" />
          </g>
          <defs>
            <linearGradient id="rt-pin-red" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#F47272" />
              <stop offset="1" stop-color="#CF3131" />
            </linearGradient>
            <radialGradient id="rt-pin-face" cx="0.4" cy="0.35" r="0.9">
              <stop offset="0" stop-color="#FFFFFF" />
              <stop offset="1" stop-color="#DDE6F0" />
            </radialGradient>
          </defs>
        </svg>
      </section>
    </div>
  `,
  styles: [
    `
      .wrap {
        max-width: 1060px;
        margin: 0 auto;
        padding: 40px 32px 80px;
      }
      .hero {
        border-radius: var(--radius-xl);
        overflow: hidden;
        border: 1px solid var(--hero-border);
        background: var(--hero-gradient);
        display: grid;
        grid-template-columns: 1.1fr 1fr;
        align-items: center;
        padding: 48px 56px;
        gap: 24px;
      }
      .copy {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }
      h1 {
        margin: 0;
        font: 800 60px/1.05 Nunito, system-ui, sans-serif;
        color: var(--text);
      }
      .tagline {
        margin: 0;
        font: 700 22px Nunito, system-ui, sans-serif;
        color: var(--hero-tagline);
      }
      .ctas {
        display: flex;
        gap: 12px;
        margin-top: 8px;
        flex-wrap: wrap;
      }
      .art {
        width: 100%;
        max-width: 340px;
        justify-self: center;
      }
      /* Kit vector, theme-swapped strokes (light: navy road/white dashes; dark: inverted). */
      .road { stroke: #24466b; animation: rtDraw 7s ease-in-out 1 both; }
      .dashes { stroke: #ffffff; animation: rtLine 7s ease-in-out 1 both; }
      .ring { stroke: #24466b; animation: rtRing 7s ease-in-out 1 both; }
      :host-context([data-theme='dark']) .road, :host-context([data-theme='dark']) .ring { stroke: #edf3fa; }
      :host-context([data-theme='dark']) .dashes { stroke: #1b3a5c; opacity: 0.75; }
      @media (prefers-color-scheme: dark) {
        :host-context(:root:not([data-theme])) .road, :host-context(:root:not([data-theme])) .ring { stroke: #edf3fa; }
        :host-context(:root:not([data-theme])) .dashes { stroke: #1b3a5c; opacity: 0.75; }
      }
      .pin { animation: rtPin 7s ease-in-out 1 both; }
      @keyframes rtDraw { 0% { stroke-dashoffset: 600; } 25% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: 0; } }
      @keyframes rtLine { 0%, 20% { opacity: 0; } 30%, 100% { opacity: 0.9; } }
      @keyframes rtRing { 0% { opacity: 0; } 6%, 100% { opacity: 1; } }
      @keyframes rtPin {
        0%, 58% { opacity: 0; transform: translateY(-30px); }
        64% { opacity: 1; transform: translateY(4px); }
        68%, 100% { opacity: 1; transform: translateY(0); }
      }
      @media (max-width: 720px) {
        .hero { grid-template-columns: 1fr; padding: 36px 24px; }
        h1 { font-size: 42px; }
        .art { max-width: 260px; }
      }
    `,
  ],
})
export class Home {}
