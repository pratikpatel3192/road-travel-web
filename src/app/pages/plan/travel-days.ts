import { Component, computed, input } from '@angular/core';

import { dayLabel } from '../../core/forecast-horizon';
import { type DerivedLeg, totalDays, totalNights } from '../../core/itinerary';
import type { PlaceValue } from './place-field';
import { formatNights } from './waypoints';

/**
 * The travel days the stops above add up to.
 *
 * These are read-only on purpose. Every other list of days in the product is editable — the saved
 * trip's itinerary screen lets you re-date a leg — but here the days are a RESULT: the traveller
 * said "three nights in Albuquerque", and this is what that means for when they drive. Letting a
 * date be typed here would make the two statements able to contradict each other, and the stops
 * are the one the traveller actually meant.
 *
 * So the days carry no inputs, and the caption says where they came from. Change a stop's nights
 * and the whole list moves; that is the thing this surface is for showing.
 */
@Component({
  selector: 'app-travel-days',
  template: `
    <p class="caption">{{ summary() }} — from your stops. Change a stop's nights and these move.</p>
    <ol class="days">
      @for (leg of legs(); track leg.ordinal) {
        <li class="day">
          <div class="head">
            <span class="num">Day {{ leg.ordinal + 1 }}</span>
            @if (leg.travelDate) {
              <span class="date">{{ date(leg) }}</span>
            } @else {
              <!-- No departure date yet. An undated day is a real answer; a guessed date would
                   decide which weather this drive is matched against. -->
              <span class="date undated">No date yet</span>
            }
            <span class="leaves">{{ leaves(leg) }}</span>
          </div>
          <p class="route">
            {{ leg.origin.name }} <span class="arrow">→</span> {{ leg.destination.name }}
          </p>
          @if (leg.waypoints.length) {
            <p class="via">via {{ via(leg) }}</p>
          }
          @if (leg.nightsAtDestination > 0) {
            <p class="stay">{{ nights(leg) }} in {{ leg.destination.name }}, then on</p>
          }
        </li>
      }
    </ol>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .caption {
        margin: 0 0 8px;
        font-size: 12px;
        font-weight: 600;
        color: var(--muted);
      }
      .days {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .day {
        padding: 10px 12px;
        border-radius: var(--radius-sm);
        background: var(--surface);
        box-shadow: var(--shadow-sm);
      }
      .head {
        display: flex;
        align-items: baseline;
        gap: 8px;
      }
      .num {
        font: 800 11px var(--font-body);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--muted);
      }
      .date {
        font: 700 13px var(--font-body);
        color: var(--text);
      }
      .date.undated {
        color: var(--muted);
        font-weight: 600;
      }
      .leaves {
        margin-left: auto;
        font-size: 12px;
        color: var(--muted);
        white-space: nowrap;
      }
      .route {
        margin: 4px 0 0;
        font: 600 14px var(--font-body);
        color: var(--text);
      }
      .arrow {
        color: var(--muted);
      }
      .via,
      .stay {
        margin: 3px 0 0;
        font-size: 12px;
        color: var(--muted);
      }
    `,
  ],
})
export class TravelDays {
  /** The derived days — never edited here, so this is a plain input rather than a model. */
  readonly legs = input.required<DerivedLeg<PlaceValue>[]>();

  /** "3 drives across 8 days, 5 nights" — what makes the list legible as an itinerary. */
  readonly summary = computed(() => {
    const legs = this.legs();
    const drives = `${legs.length} ${legs.length === 1 ? 'drive' : 'drives'}`;
    const nights = totalNights(legs);
    if (nights === 0) return `${drives} in a day`;
    return `${drives} across ${totalDays(legs)} days, ${formatNights(nights)}`;
  });

  date(leg: DerivedLeg<PlaceValue>): string {
    return leg.travelDate ? dayLabel(leg.travelDate) : '';
  }

  /**
   * "leaves 08:00" / "sometime that day" — the null case is spelled out rather than left blank,
   * because a blank reads as a field nobody filled in instead of the answer it actually is.
   */
  leaves(leg: DerivedLeg<PlaceValue>): string {
    const time = leg.departureTime;
    if (!time) return 'sometime that day';
    // Wire times may carry seconds (`HH:MM:SS`); nobody reads an itinerary to the second.
    return `leaves ${time.slice(0, 5)}`;
  }

  via(leg: DerivedLeg<PlaceValue>): string {
    return leg.waypoints.map((w) => w.name).join(', ');
  }

  nights(leg: DerivedLeg<PlaceValue>): string {
    return formatNights(leg.nightsAtDestination);
  }
}
