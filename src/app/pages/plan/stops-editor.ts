import { Component, computed, input, linkedSignal, output } from '@angular/core';
import type { PlannedDayModel } from '@road-travel/sdk';

import type { PlaceValue } from './place-field';
import { StopList } from './stop-list';
import { deriveTripDays } from './stops-summary';
import { TravelDays } from './travel-days';
import { type StopDraft, toWaypoints, waypointsKey } from './waypoints';

/**
 * The stops editor: every stop on the trip, and the days they add up to, on a screen of its own.
 *
 * It exists because the planner could not hold them. Each stop was a row of controls between origin
 * and destination and the same stops were listed again as days beneath, so two overnight stops on a
 * phone left the map a sliver and six turned the planner into a form. The planner now shows one
 * summary line, and this is where it leads.
 *
 * Edits land on a DRAFT and reach the planner only on Done, which re-plans once for the whole set
 * of changes instead of once per chip.
 */
@Component({
  selector: 'app-stops-editor',
  imports: [StopList, TravelDays],
  host: { '(document:keydown.escape)': 'finish()' },
  template: `
    <div class="backdrop" (click)="finish()"></div>
    <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="stops-editor-title">
      <header class="bar">
        <h2 id="stops-editor-title">Stops</h2>
        <button class="done" type="button" (click)="finish()">Done</button>
      </header>
      <div class="body">
        @if (origin(); as o) {
          <p class="end"><span class="dot origin"></span>{{ o.name }}</p>
        }
        <app-stop-list [stops]="draft()" [near]="near()" (stopsChange)="draft.set($event)" />
        @if (destination(); as d) {
          <p class="end"><span class="dot dest"></span>{{ d.name }}</p>
        }
        @if (legs().length > 1) {
          <h3 class="section">Your days</h3>
          <app-travel-days
            [legs]="legs()"
            [days]="shownDays()"
            [longDayOrdinals]="dirty() ? [] : longDayOrdinals()"
            [units]="units()"
            [selectedDay]="selectedDay()"
            (selectedDayChange)="pickDay($event)"
          />
        }
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        /* Above the planner and its map, below onboarding (90) and the paywall (100) a Done can
           raise. */
        z-index: 80;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
      }
      .sheet {
        position: relative;
        display: flex;
        flex-direction: column;
        width: min(480px, calc(100vw - 32px));
        max-height: min(760px, calc(100dvh - 64px));
        background: var(--bg);
        color: var(--text);
        border-radius: 20px;
        box-shadow: var(--shadow-lg);
        overflow: hidden;
      }
      /* A phone gets the whole screen: a modal inset by 16px would leave a six-stop list the same
         cramped strip the planner was. */
      @media (max-width: 959px) {
        .sheet {
          width: 100%;
          height: 100dvh;
          max-height: none;
          border-radius: 0;
        }
      }
      .bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px 12px 18px;
        border-bottom: 1px solid var(--border);
      }
      h2 {
        margin: 0;
        font-size: 20px;
      }
      .done {
        border: none;
        border-radius: var(--radius-pill);
        background: var(--accent);
        color: var(--accent-contrast);
        font: 700 14px var(--font-body);
        padding: 9px 18px;
        cursor: pointer;
      }
      .done:hover {
        background: var(--accent-hover);
      }
      .body {
        flex: 1;
        overflow-y: auto;
        padding: 8px 14px 40px;
      }
      .end {
        display: flex;
        align-items: center;
        gap: 14px;
        margin: 0;
        padding: 12px 12px 12px 26px;
        font: 600 14px var(--font-body);
        color: var(--muted);
      }
      .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex: 0 0 auto;
      }
      .dot.origin {
        background: var(--origin-dot);
      }
      .dot.dest {
        background: var(--destination-dot);
      }
      .section {
        font: 800 11px var(--font-body);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--muted);
        margin: 22px 0 8px;
      }
    `,
  ],
})
export class StopsEditor {
  /** The planner's stops when the editor opened. Never written back except through `done`. */
  readonly stops = input.required<StopDraft[]>();
  readonly origin = input<PlaceValue | null>(null);
  readonly destination = input<PlaceValue | null>(null);
  /** The planner's `datetime-local` value, so the days are dated as the plan will be. */
  readonly departureAt = input('');
  readonly near = input<{ latitude: number; longitude: number } | null>(null);
  /** The planned trip's days, when there is one — their forecasts are shown against the list. */
  readonly days = input<readonly PlannedDayModel[] | null>(null);
  readonly longDayOrdinals = input<readonly number[]>([]);
  readonly units = input<'imperial' | 'metric'>('imperial');
  readonly selectedDay = input<number | null>(null);

  /**
   * The stops on Done. Only a row that never had a place is left behind (an empty "Add stop" row
   * loses nothing); a stop being retyped keeps its place until a new one is picked.
   */
  readonly done = output<StopDraft[]>();
  readonly selectedDayChange = output<number>();

  readonly draft = linkedSignal(() => this.stops());

  readonly legs = computed(() =>
    deriveTripDays({
      origin: this.origin(),
      destination: this.destination(),
      stops: this.draft(),
      departureAt: this.departureAt(),
    }),
  );

  /** The draft no longer describes the trip that was planned. */
  readonly dirty = computed(
    () => waypointsKey(toWaypoints(this.draft())) !== waypointsKey(toWaypoints(this.stops())),
  );

  /**
   * The planned forecasts only while the draft is still that trip. Days are matched to plans by
   * ordinal, so once a night is added the old day 2's weather would sit on the new day 2 — a
   * forecast for a date nobody is driving. Nothing is shown until Done re-plans.
   */
  readonly shownDays = computed(() => (this.dirty() ? null : this.days()));

  /** Picking a day is a request to look at it, and the planner's map is where that happens. */
  pickDay(ordinal: number): void {
    this.selectedDayChange.emit(ordinal);
    this.finish();
  }

  finish(): void {
    this.done.emit(this.draft().filter((s) => !!s.place));
  }
}
