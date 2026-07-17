import { Component, computed, effect, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import type {
  AddStopPreviewResponse,
  ExploreResponse,
  PlaceCardModel,
  WaypointModel,
  WeatherSnapshotModel,
} from '@road-travel/sdk';

import { ApiService } from '../../core/api.service';
import { AccountRequiredError, ApiError, PaywallError } from '../../core/errors';
import { PaywallService } from '../../core/paywall.service';
import {
  EXPLORE_CATEGORY_CHIPS,
  EXPLORE_INTENTS,
  EXPLORE_REFINEMENTS,
  type ExploreCategory,
  type ExploreIntent,
  type ExploreRefinement,
  buildAddStopPreviewRequest,
  buildExploreRequest,
  categoryLabel,
  exposureDeltaLabel,
  formatDetour,
  worstDeltaLabel,
} from './explore';
import type { PlaceValue } from './place-field';
import { tripIdentityKey } from './rebrief';
import { SEVERITY_COLOR, type Severity, formatDuration, formatTemp, weatherEmoji } from './severity';
import { DWELL_PRESETS, type DwellMinutes, MAX_STOPS } from './waypoints';

/**
 * F-005 Trip Explorer (Pro surface on a PLANNED trip): one-tap intents → ranked stop cards along
 * the current corridor, with refinement chips (served from the server's per-trip POI cache), an
 * add-as-stop delta preview that feeds the EXISTING F-006 stop flow, and a feedback drop-box.
 *
 * Thin client (ADR-0011/ADR-0033): the server probes, ranks, filters and summarizes; Pro-gating is
 * the server's 402 → the existing paywall modal (never client-decided). Results/preview state is
 * keyed to the trip identity — any trip change (endpoints/departure/stops) clears it.
 */
@Component({
  selector: 'app-explore-panel',
  imports: [FormsModule],
  template: `
    <section class="explore">
      <header class="head">
        <h3>Explore along the way</h3>
        <button class="close" type="button" (click)="close.emit()" aria-label="Close Explore">✕</button>
      </header>

      <div class="intents" role="group" aria-label="What are you looking for?">
        @for (d of intents; track d.intent) {
          <button class="intent" type="button" [class.on]="intent() === d.intent" (click)="pickIntent(d.intent)">
            <span class="i-icon" aria-hidden="true">{{ d.icon }}</span>
            <span class="i-label">{{ d.label }}</span>
          </button>
        }
      </div>

      @if (intent() === 'add_stop_search') {
        <form class="query-row" (submit)="runSearch($event)">
          <input
            type="text"
            [(ngModel)]="query"
            name="explore-query"
            maxlength="120"
            placeholder="Find a place along the route — e.g. Starbucks"
            aria-label="What to search for along the route"
          />
          <button class="go" type="submit" [disabled]="loading() || !query.trim()">Search</button>
        </form>
      }

      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      @if (loading()) {
        <p class="hint">Scanning the corridor…</p>
      }

      @if (result(); as r) {
        <div class="chips" role="group" aria-label="Refine results">
          @for (ref of refinementDefs; track ref.value) {
            <button class="chip" type="button" [class.on]="refinements().includes(ref.value)" (click)="toggleRefinement(ref.value)">
              {{ ref.label }}
            </button>
          }
          @for (c of categoryChips(); track c.value) {
            <button class="chip" type="button" [class.on]="category() === c.value" (click)="toggleCategory(c.value)">
              {{ c.label }}
            </button>
          }
        </div>

        @if (r.summary || !r.cards.length) {
          <!-- plain text only (server-sanitized); the empty case reads as the summary line too -->
          <p class="summary">{{ r.summary || 'No good options along this stretch.' }}</p>
        }

        <ol class="results">
          @for (card of r.cards; track $index; let i = $index) {
            <li
              class="result"
              [class.sel]="i === highlighted()"
              (click)="select(i)"
              (mouseenter)="select(i)"
              (keydown.enter)="select(i)"
              tabindex="0"
            >
              <span class="num">{{ i + 1 }}</span>
              <div class="body">
                <div class="name-row">
                  <strong class="name">{{ card.name }}</strong>
                  @if (card.categories?.length) {
                    <span class="cat">{{ cat(card) }}</span>
                  }
                  @if (card.open_at_pass_time === true) {
                    <span class="open yes">Open then</span>
                  } @else if (card.open_at_pass_time === false) {
                    <span class="open no">Closed then</span>
                  }
                </div>
                <div class="meta">
                  <span>{{ detour(card.detour_meters) }}</span>
                  <span>· near your {{ time(card.pass_eta) }} point</span>
                  @if (card.brand) {
                    <span>· {{ card.brand }}</span>
                  }
                </div>
                @if (card.weather; as w) {
                  <div class="wx-row" [title]="w.condition_text">
                    <span class="wx-dot" [style.background]="sevColor(w.severity)"></span>
                    <span class="wx-emoji">{{ emoji(w) }}</span>
                    <span class="wx-temp">{{ temp(w.temperature_c) }}</span>
                    <span class="wx-text">{{ w.condition_text }} at your pass time</span>
                  </div>
                }

                @if (previewCard() === card) {
                  <div class="preview" (click)="$event.stopPropagation()">
                    @if (previewData(); as p) {
                      <p class="delta">
                        +{{ dur(p.added_seconds) }} driving{{ p.dwell_seconds > 0 ? ' + ' + dur(p.dwell_seconds) + ' stop' : '' }}
                        · arrive <strong>{{ time(p.arrival_after) }}</strong>
                        <span class="was">(was {{ time(p.arrival_before) }})</span>
                      </p>
                      <p class="delta-sub">{{ exposure(p) }} · {{ worst(p) }}</p>
                    } @else {
                      <p class="hint">Checking the detour…</p>
                    }
                    <div class="preview-row">
                      <label class="dwell">
                        <span>Stop for</span>
                        <select [ngModel]="previewDwell()" (ngModelChange)="setPreviewDwell($event)" name="preview-dwell">
                          @for (m of presets; track m) {
                            <option [ngValue]="m">{{ m === 0 ? 'Pass through' : m + ' min' }}</option>
                          }
                        </select>
                      </label>
                      <button class="confirm" type="button" (click)="confirmAdd()" [disabled]="!previewData()">Add stop</button>
                      <button class="cancel" type="button" (click)="cancelPreview()">Cancel</button>
                    </div>
                  </div>
                } @else if (canAddStop()) {
                  <button class="add-stop" type="button" (click)="openPreview(card, $event)">+ Add as stop</button>
                }
              </div>
            </li>
          }
        </ol>

        <!-- REQUIRED: POI source attribution, always rendered under the results (ADR-0033). -->
        <p class="attribution">Places data: {{ r.attribution || 'unknown source' }}</p>

        @if (feedbackSent()) {
          <p class="thanks">Thanks — noted.</p>
        } @else if (feedbackOpen()) {
          <form class="feedback" (submit)="sendFeedback($event)">
            <input
              type="text"
              [(ngModel)]="feedbackNote"
              name="explore-feedback"
              maxlength="280"
              placeholder="What were you hoping to find?"
              aria-label="What were you hoping to find?"
            />
            <button class="go" type="submit" [disabled]="sendingFeedback() || !feedbackNote.trim()">Send</button>
          </form>
        } @else {
          <button class="link" type="button" (click)="feedbackOpen.set(true)">I wanted something else</button>
        }
      }
    </section>
  `,
  styles: [
    `
      .explore {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 14px 16px;
      }
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;
      }
      h3 {
        font-size: 15px;
        margin: 0;
      }
      .intents,
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .chips {
        gap: 6px;
        margin-top: 12px;
      }
      .intent {
        display: flex;
        align-items: center;
        gap: 6px;
        border: 1px solid var(--border);
        background: var(--surface-2);
        color: var(--text);
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        padding: 8px 12px;
        border-radius: 12px;
        cursor: pointer;
      }
      .chip {
        border: 1px solid var(--border);
        background: var(--surface);
        color: var(--text);
        font: inherit;
        font-size: 12px;
        padding: 5px 10px;
        border-radius: 999px;
        cursor: pointer;
      }
      .intent:hover,
      .chip:hover {
        border-color: var(--accent);
      }
      .intent.on,
      .chip.on {
        background: var(--accent);
        border-color: var(--accent);
        color: var(--accent-contrast);
      }
      .query-row,
      .feedback {
        display: flex;
        gap: 8px;
        margin-top: 10px;
      }
      .query-row input,
      .feedback input {
        flex: 1;
        min-width: 0;
        padding: 8px 10px;
        border: 1px solid var(--border);
        border-radius: 10px;
        font: inherit;
        font-size: 13px;
        background: var(--surface);
        color: var(--text);
      }
      .go,
      .confirm {
        background: var(--accent);
        color: var(--accent-contrast);
        border: none;
        border-radius: 10px;
        padding: 8px 14px;
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      }
      .confirm {
        padding: 6px 12px;
        font-size: 12px;
        border-radius: 8px;
      }
      .go:disabled,
      .confirm:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .hint,
      .thanks,
      .summary {
        font-size: 13px;
        color: var(--muted);
        margin: 10px 0 0;
      }
      .summary {
        color: var(--text);
      }
      .error {
        color: var(--sev-severe);
        font-size: 13px;
        margin: 10px 0 0;
      }
      .results {
        list-style: none;
        padding: 0;
        margin: 10px 0 0;
        display: grid;
        gap: 8px;
      }
      .result {
        display: flex;
        gap: 10px;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: var(--surface-2);
        padding: 10px 12px;
        cursor: pointer;
      }
      .result.sel {
        box-shadow: 0 0 0 2px var(--accent);
      }
      .num {
        flex: 0 0 auto;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #2a78d6;
        color: #fff;
        display: grid;
        place-items: center;
        font-size: 11px;
        font-weight: 700;
        margin-top: 1px;
      }
      .body {
        min-width: 0;
        flex: 1;
      }
      .name-row {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .name {
        font-size: 14px;
      }
      .cat,
      .open {
        font-size: 11px;
        font-weight: 600;
        padding: 1px 7px;
        border-radius: 999px;
        border: 1px solid var(--border);
        color: var(--muted);
      }
      .open.yes {
        color: var(--sev-clear);
        border-color: var(--sev-clear);
      }
      .open.no {
        color: var(--sev-severe);
        border-color: var(--sev-severe);
      }
      .meta,
      .wx-row {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        font-size: 12px;
        color: var(--muted);
        margin-top: 3px;
      }
      .wx-row {
        align-items: center;
        gap: 6px;
        margin-top: 5px;
      }
      .wx-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex: 0 0 auto;
      }
      .wx-temp {
        font-weight: 700;
        color: var(--text);
      }
      .preview {
        margin-top: 8px;
        border-top: 1px dashed var(--border);
        padding-top: 8px;
        cursor: default;
      }
      .delta {
        font-size: 13px;
        margin: 0;
      }
      .was,
      .delta-sub {
        font-size: 12px;
        color: var(--muted);
      }
      .delta-sub {
        margin: 3px 0 0;
      }
      .preview-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 8px;
      }
      .dwell {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--muted);
        margin-right: auto;
      }
      .dwell select {
        padding: 5px 8px;
        border: 1px solid var(--border);
        border-radius: 8px;
        font: inherit;
        font-size: 12px;
        background: var(--surface);
        color: var(--text);
      }
      .add-stop,
      .link {
        background: none;
        border: none;
        padding: 0;
        margin-top: 6px;
        font: inherit;
        font-size: 12px;
        font-weight: 700;
        color: var(--accent);
        cursor: pointer;
      }
      .link {
        margin-top: 8px;
        font-weight: 500;
      }
      .add-stop:hover,
      .link:hover {
        text-decoration: underline;
      }
      .cancel,
      .close {
        background: none;
        border: none;
        color: var(--muted);
        font: inherit;
        font-size: 12px;
        cursor: pointer;
      }
      .attribution {
        font-size: 11px;
        color: var(--muted);
        margin: 10px 0 0;
        border-top: 1px solid var(--border);
        padding-top: 8px;
      }
    `,
  ],
})
export class ExplorePanel {
  private readonly api = inject(ApiService);
  private readonly paywall = inject(PaywallService);
  private readonly router = inject(Router);

  /** The CURRENT trip identity — always what the shown plan was generated with. */
  readonly origin = input.required<PlaceValue>();
  readonly destination = input.required<PlaceValue>();
  readonly departureAt = input.required<string>();
  readonly waypoints = input<WaypointModel[]>([]);
  readonly units = input<'imperial' | 'metric'>('imperial');
  /** The map-pin highlight (index into the result cards), owned by the plan page. */
  readonly highlighted = input<number | null>(null);

  readonly close = output<void>();
  /** The current result cards (for the plan page to drop numbered map pins); [] when cleared. */
  readonly cardsChange = output<PlaceCardModel[]>();
  /** Card click/hover → pin highlight (and timeline sample selection via the plan page). */
  readonly highlightChange = output<number | null>();
  /** Confirmed add-as-stop → the plan page routes it through the EXISTING F-006 stop flow. */
  readonly addStop = output<{ place: PlaceValue; dwellMinutes: DwellMinutes }>();

  readonly intents = EXPLORE_INTENTS;
  readonly refinementDefs = EXPLORE_REFINEMENTS;
  readonly presets = DWELL_PRESETS;

  readonly intent = signal<ExploreIntent | null>(null);
  readonly refinements = signal<ExploreRefinement[]>([]);
  readonly category = signal<ExploreCategory | null>(null);
  query = '';

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** Trip identity key — results/preview are only valid for the trip they were fetched for. */
  private readonly identity = computed(() =>
    tripIdentityKey({
      origin: this.origin(),
      destination: this.destination(),
      departureAt: this.departureAt(),
      waypoints: this.waypoints(),
    }),
  );

  /** The last response — auto-cleared whenever the trip identity changes (stale results). */
  readonly result = linkedSignal<string, ExploreResponse | null>({
    source: this.identity,
    computation: () => null,
  });

  /** Add-as-stop preview: the card being previewed — also identity-keyed (a trip edit voids it). */
  readonly previewCard = linkedSignal<string, PlaceCardModel | null>({
    source: this.identity,
    computation: () => null,
  });
  readonly previewDwell = signal<DwellMinutes>(30);
  readonly previewData = signal<AddStopPreviewResponse | null>(null);

  readonly feedbackOpen = signal(false);
  readonly feedbackSent = signal(false);
  readonly sendingFeedback = signal(false);
  feedbackNote = '';

  /** F-006 cap: at 3 stops "Add as stop" disappears (the server would 422 the preview anyway). */
  readonly canAddStop = computed(() => this.waypoints().length < MAX_STOPS);

  readonly categoryChips = computed(() => {
    const i = this.intent();
    return i ? EXPLORE_CATEGORY_CHIPS[i] : [];
  });

  private seq = 0;
  private previewSeq = 0;

  constructor() {
    // Mirror the cards to the plan page (map pins) — including the [] when identity-cleared.
    effect(() => {
      this.cardsChange.emit(this.result()?.cards ?? []);
    });
  }

  pickIntent(intent: ExploreIntent): void {
    this.intent.set(intent);
    this.refinements.set([]);
    this.category.set(null);
    this.feedbackOpen.set(false);
    this.feedbackSent.set(false);
    this.feedbackNote = '';
    this.error.set(null);
    this.cancelPreview();
    if (intent === 'add_stop_search') {
      // The search intent needs its query first (server 422s an empty one) — wait for submit.
      this.result.set(null);
      return;
    }
    void this.call();
  }

  runSearch(event: Event): void {
    event.preventDefault();
    if (!this.query.trim()) return;
    this.refinements.set([]);
    this.category.set(null);
    void this.call();
  }

  toggleRefinement(r: ExploreRefinement): void {
    this.refinements.set(
      this.refinements().includes(r)
        ? this.refinements().filter((x) => x !== r)
        : [...this.refinements(), r],
    );
    void this.call();
  }

  toggleCategory(c: ExploreCategory): void {
    this.category.set(this.category() === c ? null : c);
    void this.call();
  }

  /**
   * One explore call with the CURRENT trip identity + the full chip state (refinement re-calls
   * carry the prior params — the server serves them from its per-trip cache). Last call wins.
   */
  private async call(): Promise<void> {
    const intent = this.intent();
    if (!intent) return;
    const id = ++this.seq;
    this.loading.set(true);
    this.error.set(null);
    try {
      const r = await this.api.explore(
        buildExploreRequest({
          origin: this.origin(),
          destination: this.destination(),
          departureAt: this.departureAt(),
          waypoints: this.waypoints(),
          intent,
          query: this.query,
          category: this.category(),
          refinements: this.refinements(),
        }),
      );
      if (id !== this.seq) return;
      this.result.set(r);
      this.highlightChange.emit(null);
    } catch (e) {
      if (id === this.seq) this.fail(e);
    } finally {
      if (id === this.seq) this.loading.set(false);
    }
  }

  select(i: number): void {
    this.highlightChange.emit(i);
  }

  openPreview(card: PlaceCardModel, event: Event): void {
    event.stopPropagation();
    this.previewCard.set(card);
    this.previewDwell.set(30);
    this.previewData.set(null);
    void this.callPreview();
  }

  /** NOTE: the preview always reflects the CHOSEN dwell — changing it re-calls the endpoint. */
  setPreviewDwell(minutes: DwellMinutes): void {
    this.previewDwell.set(minutes);
    this.previewData.set(null);
    void this.callPreview();
  }

  private async callPreview(): Promise<void> {
    const card = this.previewCard();
    if (!card) return;
    const id = ++this.previewSeq;
    try {
      const p = await this.api.addStopPreview(
        buildAddStopPreviewRequest({
          origin: this.origin(),
          destination: this.destination(),
          departureAt: this.departureAt(),
          waypoints: this.waypoints(),
          stop: { name: card.name, latitude: card.latitude, longitude: card.longitude },
          dwellMinutes: this.previewDwell(),
        }),
      );
      if (id !== this.previewSeq || this.previewCard() !== card) return;
      this.previewData.set(p);
    } catch (e) {
      if (id !== this.previewSeq) return;
      this.cancelPreview();
      this.fail(e);
    }
  }

  confirmAdd(): void {
    const card = this.previewCard();
    if (!card || !this.previewData()) return;
    // The plan page appends the stop through the F-006 stop-list flow (re-plan + briefing
    // refresh); the resulting identity change clears our now-stale results and this preview.
    this.addStop.emit({
      place: { name: card.name, latitude: card.latitude, longitude: card.longitude },
      dwellMinutes: this.previewDwell(),
    });
  }

  cancelPreview(): void {
    this.previewCard.set(null);
    this.previewData.set(null);
  }

  async sendFeedback(event: Event): Promise<void> {
    event.preventDefault();
    const intent = this.intent();
    const note = this.feedbackNote.trim().slice(0, 280);
    if (!intent || !note) return;
    this.sendingFeedback.set(true);
    try {
      await this.api.exploreFeedback({ intent, note });
      // Recorded, never answered (ADR-0033 §6) — just clear the input and thank the driver.
      this.feedbackNote = '';
      this.feedbackOpen.set(false);
      this.feedbackSent.set(true);
    } catch (e) {
      this.fail(e);
    } finally {
      this.sendingFeedback.set(false);
    }
  }

  /** Same gate handling as planning: 401 → sign-in wall, 402 → the server's paywall modal. */
  private fail(e: unknown): void {
    if (e instanceof AccountRequiredError) this.router.navigate(['/login']);
    else if (e instanceof PaywallError) this.paywall.show(e.payload);
    else if (e instanceof ApiError && e.status === 422) this.error.set(e.message);
    else this.error.set('Could not explore this route right now. Please try again.');
  }

  cat(card: PlaceCardModel): string {
    return categoryLabel(card.categories?.[0]);
  }
  detour(meters: number): string {
    return formatDetour(meters, this.units());
  }
  time(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  dur(seconds: number): string {
    return formatDuration(seconds);
  }
  emoji(w: WeatherSnapshotModel): string {
    return weatherEmoji(w.condition_symbol, w.condition_text);
  }
  temp(c: number): string {
    return formatTemp(c, this.units());
  }
  sevColor(sev: string): string {
    return SEVERITY_COLOR[(sev as Severity) ?? 'clear'] ?? SEVERITY_COLOR.clear;
  }
  exposure(p: AddStopPreviewResponse): string {
    return exposureDeltaLabel(p);
  }
  worst(p: AddStopPreviewResponse): string {
    return worstDeltaLabel(p);
  }
}
