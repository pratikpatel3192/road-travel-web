import { Component, type OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { TripLegModel } from '@road-travel/sdk';

import { ApiService } from '../../core/api.service';
import { AccountRequiredError, PaywallError } from '../../core/errors';
import { type Tier, dayLabel, isoDay, parseIsoDay, tierForDay } from '../../core/forecast-horizon';
import { PaywallService } from '../../core/paywall.service';
import { TripsService } from '../../core/trips.service';
import { IconComponent } from '../../ui/icon';
import { PlaceField, type PlaceValue } from '../plan/place-field';

/**
 * The itinerary: a saved trip as a sequence of dated travel days.
 *
 * A trip used to be one origin → destination with a single departure. That is the right shape for
 * "what is tomorrow's drive like" and the wrong one for the people this product is actually for —
 * full-timers, snowbirds, anyone doing a parks tour — who plan in weeks and months. This screen is
 * where a month-long trip becomes editable: add days, reorder them, re-date them.
 *
 * **The one thing this screen must get right** is that the reader can see, at a glance, where the
 * real forecast stops. The strip at the top is there for exactly that: the first stretch is a
 * forecast, the rest is what the road is usually like at that time of year, and the two are drawn
 * differently so nobody has to read a label to notice.
 */
@Component({
  selector: 'app-itinerary',
  imports: [FormsModule, RouterLink, IconComponent, PlaceField],
  template: `
    <div class="page">
      <header class="top">
        <a routerLink="/saved" class="back" aria-label="Back to my trips">←</a>
        <h1>Itinerary</h1>
      </header>

      @if (loading()) {
        <p class="empty">Loading your itinerary…</p>
      } @else {
        @if (legs().length) {
          <!-- The boundary, drawn rather than described. -->
          <section class="strip card" aria-label="Where the forecast stops">
            <div class="cells">
              @for (leg of legs(); track leg.id ?? $index) {
                <span
                  class="cell"
                  [class.forecast]="tier(leg) === 'forecast'"
                  [class.outlook]="tier(leg) === 'outlook'"
                  [class.undated]="tier(leg) === null"
                  [class.boundary]="$index === boundaryIndex()"
                  [attr.title]="cellTitle(leg)"
                ></span>
              }
            </div>
            <p class="strip-copy">{{ boundaryCopy() }}</p>
          </section>
        }

        <ol class="legs">
          @for (leg of legs(); track leg.id ?? $index) {
            <li class="leg card">
              <div class="leg-head">
                <span class="day">Day {{ $index + 1 }}</span>
                <span
                  class="tier"
                  [class.is-forecast]="tier(leg) === 'forecast'"
                  [class.is-outlook]="tier(leg) === 'outlook'"
                  >{{ tierLabel(leg) }}</span
                >
                <span class="spacer"></span>
                <button
                  class="mini"
                  (click)="move($index, -1)"
                  [disabled]="$index === 0"
                  aria-label="Move this day earlier in the trip"
                >
                  ↑
                </button>
                <button
                  class="mini"
                  (click)="move($index, 1)"
                  [disabled]="$index === legs().length - 1"
                  aria-label="Move this day later in the trip"
                >
                  ↓
                </button>
                <button class="mini del" (click)="remove($index)" aria-label="Remove this day">
                  ✕
                </button>
              </div>

              <p class="route">
                {{ short(leg.origin.name) }} <span class="arrow">→</span>
                {{ short(leg.destination.name) }}
              </p>

              <div class="when">
                <label class="ctl">
                  <span>Date</span>
                  <input
                    type="date"
                    [ngModel]="leg.travel_date ?? ''"
                    (ngModelChange)="setDate($index, $event)"
                    [name]="'date' + $index"
                  />
                </label>
                <label class="ctl">
                  <span>Leaving</span>
                  <input
                    type="time"
                    [ngModel]="leg.departure_time ?? ''"
                    (ngModelChange)="setTime($index, $event)"
                    [name]="'time' + $index"
                    [disabled]="!leg.travel_date"
                  />
                </label>
              </div>
              @if (!leg.travel_date) {
                <p class="hint">
                  Undated — this day shows no weather until you give it a date. We don't guess one.
                </p>
              } @else if (!leg.departure_time) {
                <p class="hint">
                  No time set, which is fine — we'll treat it as sometime that day.
                </p>
              }

              <!-- Server-written, and only on a leg where the real forecast turned out worse than
                   history suggested. Nothing is rendered for the legs that came back fine. -->
              @if (leg.upgrade_summary) {
                <p class="note">
                  <app-icon name="triangle-alert" [size]="14" />
                  <span>{{ leg.upgrade_summary }}</span>
                </p>
              }
            </li>
          } @empty {
            <li class="empty card">
              <strong>No days yet.</strong>
              Add the first driving day and we'll date the rest from there.
            </li>
          }
        </ol>

        <section class="add card">
          <h2>Add a day</h2>
          <p class="add-copy">
            Starting from
            <strong>{{ short(nextOriginName()) }}</strong>
            — where are you driving to?
          </p>
          <app-place-field
            kind="destination"
            placeholder="Destination for this day"
            [(place)]="newDestination"
          />
          <label class="ctl">
            <span>Date</span>
            <input type="date" [(ngModel)]="newDate" name="newDate" />
          </label>
          <button class="go" (click)="add()" [disabled]="!newDestination()">Add day</button>
        </section>

        @if (warnings().length) {
          <ul class="warnings" role="status">
            @for (w of warnings(); track w) {
              <li>{{ w }}</li>
            }
          </ul>
        }
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }

        <div class="actions">
          <button class="go" (click)="save()" [disabled]="saving() || !dirty()">
            {{ saving() ? 'Saving…' : dirty() ? 'Save itinerary' : 'Saved' }}
          </button>
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
        margin-bottom: 12px;
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
        margin: 0;
        font-size: 22px;
      }
      h2 {
        margin: 0 0 4px;
        font-size: 15px;
      }
      .card {
        padding: 12px 14px;
        border: 1px solid var(--border);
        border-radius: 14px;
        background: var(--surface);
        margin-bottom: 10px;
      }
      .cells {
        display: flex;
        gap: 3px;
      }
      .cell {
        flex: 1;
        height: 14px;
        border-radius: 4px;
        background: var(--border);
      }
      /* A forecast is solid; an outlook is hatched and desaturated. The difference has to survive
         being glanced at, and it must never be a severity colour — that vocabulary belongs to a
         forecast and borrowing it is how history starts reading as a prediction. */
      .cell.forecast {
        background: var(--accent, #c67139);
      }
      .cell.outlook {
        background: repeating-linear-gradient(
          45deg,
          var(--text-tertiary, #a19786) 0 3px,
          transparent 3px 6px
        );
        border: 1px solid var(--border);
      }
      .cell.undated {
        background: transparent;
        border: 1px dashed var(--text-tertiary, #a19786);
        opacity: 0.6;
      }
      /* Where the forecast stops. The texture change alone is a difference you have to look for;
         this is the line you cannot miss. */
      .cell.boundary {
        border-left: 3px solid var(--text, #201e1d);
        margin-left: 3px;
      }
      .strip-copy {
        margin: 8px 0 0;
        font-size: 12px;
        color: var(--text-secondary, #82796a);
      }
      .legs {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .leg-head {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .day {
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--text-secondary, #82796a);
      }
      .tier {
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        background: var(--well, #f9f4ed);
        color: var(--text-secondary, #82796a);
      }
      .tier.is-forecast {
        background: color-mix(in srgb, var(--accent, #c67139) 16%, transparent);
        color: var(--accent-dark, #8c491a);
      }
      .spacer {
        flex: 1;
      }
      .mini {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        border: 1px solid var(--border);
        background: var(--surface);
        color: var(--text);
      }
      .mini:disabled {
        opacity: 0.35;
      }
      .mini.del {
        color: #b3261e;
      }
      .route {
        margin: 8px 0 0;
        font-size: 15px;
        font-weight: 600;
      }
      .arrow {
        color: var(--text-tertiary, #a19786);
      }
      .when {
        display: flex;
        gap: 10px;
        margin-top: 8px;
      }
      .ctl {
        display: grid;
        gap: 4px;
        font-size: 12px;
        color: var(--text-secondary, #82796a);
      }
      .ctl input {
        padding: 7px 9px;
        border: 1px solid var(--border);
        border-radius: 9px;
        background: var(--surface);
        color: var(--text);
        font: inherit;
      }
      .hint,
      .add-copy {
        margin: 8px 0 0;
        font-size: 12px;
        color: var(--text-secondary, #82796a);
      }
      .note {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        margin: 10px 0 0;
        padding: 9px 11px;
        border-radius: 11px;
        background: var(--sage-bg, #f0fae1);
        color: var(--sage-ink, #272e1b);
        font-size: 13px;
        font-weight: 600;
      }
      .add app-place-field {
        display: block;
        margin: 8px 0;
      }
      .warnings {
        margin: 0 0 10px;
        padding: 10px 12px 10px 30px;
        border-radius: 12px;
        background: var(--well, #f9f4ed);
        color: var(--text-secondary, #82796a);
        font-size: 13px;
      }
      .error {
        margin: 0 0 10px;
        color: #b3261e;
        font-size: 13px;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
      }
      .go {
        padding: 11px 20px;
        border: none;
        border-radius: 999px;
        background: var(--accent, #c67139);
        color: #fff;
        font-weight: 700;
        font-size: 14px;
      }
      .go:disabled {
        opacity: 0.5;
      }
      .empty {
        text-align: center;
        font-size: 13px;
        color: var(--text-secondary, #82796a);
      }
    `,
  ],
})
export class Itinerary implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly paywall = inject(PaywallService);
  private readonly trips = inject(TripsService);

  readonly legs = signal<TripLegModel[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  /** Set on the first local edit; cleared by a successful save. Nothing saves by itself. */
  readonly dirty = signal(false);

  readonly newDestination = signal<PlaceValue | null>(null);
  newDate = '';

  private tripId = '';

  async ngOnInit(): Promise<void> {
    this.tripId = this.route.snapshot.paramMap.get('tripId') ?? '';
    if (!this.tripId) {
      void this.router.navigate(['/saved']);
      return;
    }
    try {
      const response = await this.api.tripLegs(this.tripId);
      this.legs.set(response.legs);
      this.warnings.set(response.warnings ?? []);
      // A trip saved before legs existed has none. Seeding one from the trip's own endpoints is
      // the honest migration: it is the drive they saved, it just did not have a day of its own.
      if (!response.legs.length) this.seedFromTrip();
    } catch (err) {
      this.handle(err);
    } finally {
      this.loading.set(false);
    }
  }

  /** The trip itself, as its one undated leg — dates are for the traveller to fill in. */
  private seedFromTrip(): void {
    const trip = this.trips.saved().find((t) => t.id === this.tripId);
    if (!trip) return;
    this.legs.set([
      {
        ordinal: 0,
        origin: {
          name: trip.origin_name,
          latitude: trip.origin_latitude ?? 0,
          longitude: trip.origin_longitude ?? 0,
        },
        destination: {
          name: trip.destination_name,
          latitude: trip.destination_latitude ?? 0,
          longitude: trip.destination_longitude ?? 0,
        },
        waypoints: trip.waypoints ?? [],
        travel_date: trip.departure_at ? isoDay(new Date(trip.departure_at)) : null,
      },
    ]);
    this.dirty.set(true);
  }

  tier(leg: TripLegModel): Tier | null {
    return leg.travel_date ? tierForDay(leg.travel_date) : null;
  }

  tierLabel(leg: TripLegModel): string {
    const tier = this.tier(leg);
    if (tier === 'forecast') return 'Forecast';
    if (tier === 'outlook') return 'Typical conditions';
    return 'No date';
  }

  cellTitle(leg: TripLegModel): string {
    const when = leg.travel_date ? dayLabel(leg.travel_date) : 'undated';
    return `${when} — ${this.tierLabel(leg).toLowerCase()}`;
  }

  /**
   * The sentence under the strip. It names how much of the trip is real rather than leaving the
   * reader to count cells, and it says plainly what the rest of it is.
   */
  readonly boundaryCopy = computed(() => {
    const dated = this.legs().filter((l) => l.travel_date);
    if (!dated.length) return 'Give these days dates and we’ll show what the weather is doing.';
    const forecast = dated.filter((l) => this.tier(l) === 'forecast').length;
    const outlook = dated.length - forecast;
    if (!outlook) return 'Every day of this trip has a real forecast.';
    if (!forecast) {
      return 'This trip is still too far out to forecast — every day shows what those roads are usually like at that time of year. We’ll swap in the real forecast about 10 days out.';
    }
    const days = forecast === 1 ? 'day' : 'days';
    return `The first ${forecast} ${days} have a real forecast. The other ${outlook} show what those roads are usually like at that time of year — history, not a forecast.`;
  });

  /**
   * Which cell the forecast stops before — the first outlook day with any forecast day ahead of it.
   *
   * `-1` when there is nothing to mark: an all-forecast trip has no boundary, and neither does one
   * that is entirely beyond the horizon (there, the copy says so outright rather than drawing a
   * line at position zero as if something changed there).
   */
  readonly boundaryIndex = computed(() => {
    const legs = this.legs();
    const first = legs.findIndex((l) => this.tier(l) === 'outlook');
    if (first <= 0) return -1;
    return legs.slice(0, first).some((l) => this.tier(l) === 'forecast') ? first : -1;
  });

  readonly nextOriginName = computed(() => {
    const last = this.legs().at(-1);
    if (last) return last.destination.name;
    const trip = this.trips.saved().find((t) => t.id === this.tripId);
    return trip?.destination_name ?? 'your last stop';
  });

  setDate(index: number, value: string): void {
    this.edit(index, (leg) => ({
      ...leg,
      travel_date: value || null,
      // A time on no day means nothing, and the server rejects the pair — so clearing the date
      // clears the time with it rather than failing the save.
      departure_time: value ? leg.departure_time : null,
    }));
  }

  setTime(index: number, value: string): void {
    this.edit(index, (leg) => ({ ...leg, departure_time: value || null }));
  }

  private edit(index: number, change: (leg: TripLegModel) => TripLegModel): void {
    const next = [...this.legs()];
    next[index] = change(next[index]);
    this.legs.set(this.renumber(next));
    this.dirty.set(true);
  }

  move(index: number, by: number): void {
    const target = index + by;
    const next = [...this.legs()];
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    this.legs.set(this.renumber(next));
    this.dirty.set(true);
  }

  remove(index: number): void {
    this.legs.set(this.renumber(this.legs().filter((_, i) => i !== index)));
    this.dirty.set(true);
  }

  add(): void {
    const destination = this.newDestination();
    if (!destination) return;
    const last = this.legs().at(-1);
    const trip = this.trips.saved().find((t) => t.id === this.tripId);
    const origin = last
      ? last.destination
      : {
          name: trip?.destination_name ?? destination.name,
          latitude: trip?.destination_latitude ?? destination.latitude,
          longitude: trip?.destination_longitude ?? destination.longitude,
        };
    this.legs.set(
      this.renumber([
        ...this.legs(),
        {
          ordinal: this.legs().length,
          origin,
          destination,
          waypoints: [],
          travel_date: this.newDate || this.dayAfterLast(),
        },
      ]),
    );
    this.newDestination.set(null);
    this.newDate = '';
    this.dirty.set(true);
  }

  /**
   * The day after the last dated leg, as the default for a new one. A guess, but a visible and
   * editable one sitting in a date field the traveller is looking at — unlike a date guessed
   * server-side, which would silently decide which weather the leg is matched against.
   */
  private dayAfterLast(): string | null {
    const dates = this.legs()
      .map((l) => parseIsoDay(l.travel_date))
      .filter((d): d is Date => d !== null);
    if (!dates.length) return null;
    const latest = new Date(Math.max(...dates.map((d) => d.getTime())));
    latest.setDate(latest.getDate() + 1);
    return isoDay(latest);
  }

  /** Ordinal is position, and position is the list. Re-derived rather than tracked. */
  private renumber(legs: TripLegModel[]): TripLegModel[] {
    return legs.map((leg, ordinal) => ({ ...leg, ordinal }));
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      // The whole list, because reordering and re-dating ARE whole-list edits. Legs keep their
      // `id`, which is how the server carries each one's upgrade state across the rewrite — drop
      // the id and every save re-arms that leg's notification.
      const response = await this.api.replaceTripLegs(this.tripId, this.legs());
      this.legs.set(response.legs);
      this.warnings.set(response.warnings ?? []);
      this.dirty.set(false);
    } catch (err) {
      this.handle(err);
    } finally {
      this.saving.set(false);
    }
  }

  private handle(err: unknown): void {
    if (err instanceof PaywallError) {
      this.paywall.show(err.payload);
      return;
    }
    if (err instanceof AccountRequiredError) {
      void this.router.navigate(['/login']);
      return;
    }
    this.error.set(
      err instanceof Error ? err.message : 'Something went wrong saving your itinerary.',
    );
  }

  short(name: string): string {
    return name.split(',')[0];
  }
}
