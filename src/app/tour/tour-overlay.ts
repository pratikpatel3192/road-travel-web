import {
  Component,
  DestroyRef,
  type ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

import { TOUR_LABELS, tourCountLabel } from './tour-script';
import { type TourRect, hasForeignModal, tourTargetElements, tourTargetRect } from './tour-targets';
import { TourService } from './tour.service';

/** Room kept between the card, the spotlight and the viewport edges. */
const GAP = 12;
const MARGIN = 16;
/** The spotlight is a little larger than its element, so the element's own edge stays readable. */
const PAD = 6;
const CARD_MAX_WIDTH = 340;
/** Until the card has rendered once there is nothing to measure. */
const CARD_HEIGHT_GUESS = 190;
/**
 * Safety-net re-measure while the tour is up. Resize and scroll are listened to directly, but the
 * planner also moves without either — the header gains links when the session resolves, a place
 * field grows, the stops line changes — and a spotlight left behind by one of those points at the
 * wrong thing. Cheap: one querySelectorAll per tick, for the few seconds a tour lasts.
 */
const REMEASURE_MS = 400;

/**
 * The spotlight tour's overlay: a dimmed page with a cut-out around the step's element, and the
 * tip card beside it.
 *
 * Mounted once in the app shell rather than inside the planner, because two of the five targets
 * (My trips, Sign in / Settings) are in the site header, outside the planner's own DOM. Renders
 * nothing unless {@link TourService} has a step up.
 */
@Component({
  selector: 'app-tour-overlay',
  host: { '(document:keydown)': 'onKeydown($event)' },
  template: `
    @if (shown() && tour.step(); as step) {
      <!-- Swallows every pointer event on the page while the tour is up, including inside the
           cut-out: a click that typed into a field or planned a trip mid-tour would leave the tour
           describing a page that had changed under it. Not a dismiss target either — a stray tap
           should not throw the tour away. -->
      <!-- mousedown is cancelled so a click here doesn't also pull focus out of the card. -->
      <div
        class="blocker"
        [class.dim]="!hole()"
        (mousedown)="$event.preventDefault()"
        (click)="$event.stopPropagation()"
      ></div>
      @if (hole(); as h) {
        <div
          class="hole"
          aria-hidden="true"
          [style.top.px]="h.top"
          [style.left.px]="h.left"
          [style.width.px]="h.width"
          [style.height.px]="h.height"
        ></div>
      }
      <div
        #card
        class="card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-count tour-body"
        tabindex="-1"
        [style.top.px]="cardBox().top"
        [style.left.px]="cardBox().left"
        [style.width.px]="cardBox().width"
      >
        <p id="tour-count" class="count"><span class="sr-only">Step </span>{{ count() }}</p>
        <h2 id="tour-title">{{ step.title }}</h2>
        <p id="tour-body" class="body">{{ step.body }}</p>
        <div class="actions">
          <button type="button" class="skip" (click)="tour.complete()">{{ labels.skip }}</button>
          @if (!tour.isFirst()) {
            <button type="button" class="back" (click)="tour.back()">{{ labels.back }}</button>
          }
          <button type="button" class="next" (click)="tour.next()">
            {{ tour.isLast() ? labels.done : labels.next }}
          </button>
        </div>
      </div>
    }
  `,
  styles: [
    `
      /* Above the planner, its map and the header (and the stops editor, 80, which never shares the
         screen with it); below onboarding (90) and the paywall (100), which can still arrive on their
         own mid-tour — the overlay also hides itself while one of those is up. */
      .blocker {
        position: fixed;
        inset: 0;
        z-index: 85;
        background: transparent;
      }
      .blocker.dim {
        background: var(--tour-dim);
      }
      /* The cut-out: a transparent box whose enormous shadow is the dimming. */
      .hole {
        position: fixed;
        z-index: 86;
        pointer-events: none;
        border-radius: 14px;
        box-shadow:
          0 0 0 3px var(--accent),
          0 0 0 200vmax var(--tour-dim);
        transition:
          top 220ms ease-out,
          left 220ms ease-out,
          width 220ms ease-out,
          height 220ms ease-out;
      }
      .card {
        position: fixed;
        z-index: 87;
        max-height: calc(100dvh - 32px);
        overflow-y: auto;
        padding: 16px 18px 14px;
        border-radius: var(--radius-md);
        background: var(--surface);
        color: var(--text);
        box-shadow: var(--shadow-lg);
        transition:
          top 220ms ease-out,
          left 220ms ease-out;
      }
      .card:focus {
        outline: none;
      }
      .card:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
      .count {
        margin: 0 0 4px;
        font: 800 11px var(--font-body);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--muted);
      }
      h2 {
        margin: 0 0 6px;
        font-size: 20px;
        line-height: 1.2;
      }
      .body {
        margin: 0 0 14px;
        font-size: 14px;
        line-height: 1.45;
        color: var(--text);
      }
      .actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .actions button {
        border-radius: var(--radius-pill);
        font: 700 14px var(--font-body);
        padding: 9px 16px;
        cursor: pointer;
        min-height: 40px;
      }
      /* Skip sits apart on the left so it is never mistaken for Next. */
      .skip {
        margin-right: auto;
        background: none;
        border: none;
        color: var(--muted);
        padding-inline: 4px;
      }
      .skip:hover {
        color: var(--text);
      }
      .back {
        background: var(--surface-2);
        border: 1.5px solid var(--border);
        color: var(--text);
      }
      .next {
        background: var(--accent);
        border: none;
        color: var(--accent-contrast);
        box-shadow: var(--shadow-sm);
      }
      .next:hover {
        background: var(--accent-hover);
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }
      @media (prefers-reduced-motion: reduce) {
        .hole,
        .card {
          transition: none;
        }
      }
      :host {
        /* Dark enough to separate the spotlight on the cream page, and still reads on the night
           theme, whose page is already dark. */
        --tour-dim: rgba(20, 17, 14, 0.62);
      }
    `,
  ],
})
export class TourOverlay {
  readonly tour = inject(TourService);
  readonly labels = TOUR_LABELS;

  private readonly card = viewChild<ElementRef<HTMLElement>>('card');

  /** Another dialog is up — see {@link hasForeignModal}. */
  private readonly suspended = signal(false);
  readonly shown = computed(() => this.tour.active() && !this.suspended());

  readonly hole = signal<TourRect | null>(null);
  private readonly viewport = signal({ width: 1024, height: 768 });
  private readonly cardHeight = signal(CARD_HEIGHT_GUESS);

  readonly count = computed(() => tourCountLabel(this.tour.index() + 1, this.tour.steps().length));

  /**
   * Under the spotlight if the card fits there, else above it, else pinned to whichever viewport
   * edge has more room (a phone with the target mid-screen). Horizontally it starts where the
   * target does and is pushed back inside the margins.
   */
  readonly cardBox = computed(() => {
    const { width: vw, height: vh } = this.viewport();
    const width = Math.min(CARD_MAX_WIDTH, vw - 2 * MARGIN);
    const ch = this.cardHeight();
    const h = this.hole();
    if (!h) {
      return { top: Math.max(MARGIN, (vh - ch) / 2), left: (vw - width) / 2, width };
    }
    const below = vh - (h.top + h.height) - GAP - MARGIN;
    const above = h.top - GAP - MARGIN;
    let top: number;
    if (below >= ch) top = h.top + h.height + GAP;
    else if (above >= ch) top = h.top - GAP - ch;
    else top = below >= above ? vh - ch - MARGIN : MARGIN;
    const left = Math.min(Math.max(h.left, MARGIN), vw - width - MARGIN);
    return { top: Math.max(MARGIN, top), left: Math.max(MARGIN, left), width };
  });

  private returnFocus: HTMLElement | null = null;
  private frame = 0;
  private detach: (() => void) | null = null;

  constructor() {
    // Listeners exist only while a tour is up.
    effect(() => {
      if (this.tour.active()) untracked(() => this.attach());
      else untracked(() => this.release());
    });

    // A new step: measure it, bring it into view, and move focus to its card.
    effect(() => {
      const step = this.tour.step();
      if (!step) return;
      untracked(() => {
        this.measure();
        this.revealTarget();
        setTimeout(() => this.focusCard());
      });
    });

    inject(DestroyRef).onDestroy(() => this.release());
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.shown()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.tour.complete();
      return;
    }
    if (event.key === 'Tab') this.trapTab(event);
  }

  /** Tab and Shift+Tab cycle the card's own buttons; focus never reaches the page underneath. */
  private trapTab(event: KeyboardEvent): void {
    const card = this.card()?.nativeElement;
    if (!card) return;
    const buttons = [...card.querySelectorAll<HTMLElement>('button')];
    if (!buttons.length) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    const at = document.activeElement as HTMLElement | null;
    const inside = !!at && card.contains(at);
    if (event.shiftKey && (!inside || at === first || at === card)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (!inside || at === last)) {
      event.preventDefault();
      first.focus();
    }
  }

  private attach(): void {
    if (this.detach) return;
    this.returnFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const schedule = () => {
      if (this.frame) return;
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.measure();
      });
    };
    // Capture, so the planner panel's own scroll (desktop) is heard, not just the window's.
    window.addEventListener('resize', schedule);
    document.addEventListener('scroll', schedule, { capture: true, passive: true });
    const timer = setInterval(() => this.measure(), REMEASURE_MS);
    this.detach = () => {
      window.removeEventListener('resize', schedule);
      document.removeEventListener('scroll', schedule, { capture: true });
      clearInterval(timer);
      if (this.frame) cancelAnimationFrame(this.frame);
      this.frame = 0;
    };
  }

  private release(): void {
    if (!this.detach) return;
    this.detach();
    this.detach = null;
    this.hole.set(null);
    this.suspended.set(false);
    // Back to where the traveller was, if that is still on the page.
    const back = this.returnFocus;
    this.returnFocus = null;
    if (back?.isConnected) back.focus({ preventScroll: true });
  }

  /** Re-read the page: the target's box, the viewport, the card's height, and any other dialog. */
  measure(): void {
    const step = this.tour.step();
    if (!step) return;
    const wasSuspended = this.suspended();
    this.suspended.set(hasForeignModal());
    this.viewport.set({ width: window.innerWidth, height: window.innerHeight });
    const cardEl = this.card()?.nativeElement;
    if (cardEl?.offsetHeight) this.cardHeight.set(cardEl.offsetHeight);
    const rect = tourTargetRect(step.target);
    if (!rect) {
      // Its element went away (a resize re-flowed the page): move on rather than point at nothing.
      if (!this.suspended()) this.tour.skipMissing();
      return;
    }
    this.hole.set({
      top: rect.top - PAD,
      left: rect.left - PAD,
      width: rect.width + 2 * PAD,
      height: rect.height + 2 * PAD,
    });
    // Coming back from under another dialog: focus is wherever that dialog left it.
    if (wasSuspended && !this.suspended()) setTimeout(() => this.focusCard());
  }

  /** Scroll the target on screen when it isn't — on a phone the Get briefing button is below the map. */
  private revealTarget(): void {
    const step = this.tour.step();
    const rect = this.hole();
    if (!step || !rect) return;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const inView =
      rect.top >= 0 &&
      rect.top + rect.height <= vh &&
      rect.left >= 0 &&
      rect.left + rect.width <= vw;
    if (inView) return;
    const el = tourTargetElements(step.target)[0];
    if (!el) return;
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // The scroll events it fires move the spotlight along with it.
    el.scrollIntoView?.({
      block: 'center',
      inline: 'nearest',
      behavior: reduced ? 'auto' : 'smooth',
    });
  }

  private focusCard(): void {
    if (!this.shown()) return;
    this.card()?.nativeElement.focus({ preventScroll: true });
  }
}
