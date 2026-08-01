import type { BriefingFactsModel, WaypointModel } from '@road-travel/sdk';

import type { PlaceValue } from './place-field';
import { waypointsKey } from './waypoints';

/**
 * Re-brief keys and the remembered facts behind the US-11 "what changed" line.
 *
 * **Two keys, two jobs (F-012 / ADR-0040).** They used to be one, which is why a deliberate edit
 * could never produce a diff:
 *
 * - {@link tripIdentityKey} — *"does the shown briefing still describe the shown plan?"* Endpoints
 *   + departure + waypoints/dwell. Any plan change invalidates the displayed briefing. This is the
 *   F-001 US-3 / ADR-0031 §3 staleness rule and it deliberately has NOT relaxed: loosening it would
 *   leave a briefing about the old plan sitting next to the new one.
 * - {@link tripBaselineKey} — *"which remembered facts do I diff against?"* Endpoints only. Move
 *   your departure two hours and the baseline still matches, so the server can tell you the pass
 *   went from rain to ice. A genuinely different **trip** still matches nothing, which is correct
 *   and stays.
 *
 * Both are pinned against `road-travel-docs/test-vectors/trip-keys.vectors.json`, shared with the
 * Swift implementation — the two platforms had already drifted on the departure component before
 * those vectors existed.
 */

/** Coordinates compare at ~11 m on both platforms, so JSON float noise is not an edit. */
const COORD_DECIMALS = 4;

function place(p: PlaceValue): string {
  return `${p.name}@${p.latitude.toFixed(COORD_DECIMALS)},${p.longitude.toFixed(COORD_DECIMALS)}`;
}

export interface TripKeyInputs {
  origin: PlaceValue;
  destination: PlaceValue;
  departureAt: string;
  waypoints?: readonly WaypointModel[];
}

/**
 * Full plan identity — endpoints + departure + the F-006 waypoints/dwell key. Changing ANY of them
 * means the shown briefing no longer describes the shown plan, so it must be regenerated.
 */
export function tripIdentityKey(args: TripKeyInputs): string {
  return [
    place(args.origin),
    place(args.destination),
    args.departureAt,
    waypointsKey(args.waypoints ?? []),
  ].join('>');
}

/**
 * Which trip this is, independent of *which version of the plan*. Departure and stops are
 * deliberately absent: they are the plan, not the trip. Pass `savedTripId` when the trip is a saved
 * one — then the server's own baseline (ADR-0039) is authoritative and this is only the local key.
 */
export function tripBaselineKey(
  args: Pick<TripKeyInputs, 'origin' | 'destination'> & { savedTripId?: string | null },
): string {
  if (args.savedTripId) return `trip:${args.savedTripId}`;
  return [place(args.origin), place(args.destination)].join('>');
}

/**
 * Remembered facts per trip, for the local (unsaved / signed-out) re-brief path.
 *
 * Keyed by {@link tripBaselineKey} — a map, not the single slot this used to be. The old shape held
 * one key and one fact set, so briefing trip A, then trip B, then returning to A lost A's baseline
 * entirely. Bounded so a long session can't grow without limit; the server-side baseline (ADR-0039)
 * is what actually survives a reload and crosses devices.
 */
const MAX_REMEMBERED_TRIPS = 20;

export class BriefingMemory {
  private readonly facts = new Map<string, BriefingFactsModel>();

  /** The prior facts to send for this trip — undefined when it has never been briefed here. */
  previousFactsFor(key: string): BriefingFactsModel | undefined {
    return this.facts.get(key);
  }

  /** Store the freshly returned facts as this trip's new baseline (most-recent-wins). */
  remember(key: string, facts: BriefingFactsModel): void {
    // Re-insert so Map iteration order tracks recency, then evict the oldest.
    this.facts.delete(key);
    this.facts.set(key, facts);
    while (this.facts.size > MAX_REMEMBERED_TRIPS) {
      const oldest = this.facts.keys().next();
      if (oldest.done) break;
      this.facts.delete(oldest.value);
    }
  }
}
