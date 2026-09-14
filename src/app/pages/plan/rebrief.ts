import type { BriefingFactsModel, DaySnapshotModel, WaypointModel } from '@road-travel/sdk';

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

/** Re-insert so Map iteration order tracks recency, then evict the oldest. */
function rememberIn<T>(store: Map<string, T>, key: string, value: T): void {
  store.delete(key);
  store.set(key, value);
  while (store.size > MAX_REMEMBERED_TRIPS) {
    const oldest = store.keys().next();
    if (oldest.done) break;
    store.delete(oldest.value);
  }
}

export class BriefingMemory {
  private readonly facts = new Map<string, BriefingFactsModel>();
  /**
   * The whole-trip counterpart, kept in the SAME place and under the SAME key as the single-day
   * baseline rather than in storage of its own.
   *
   * Two stores rather than one field of a union type because the two endpoints are not
   * interchangeable: `/v1/briefings` takes `previous_facts` and `/v1/briefings/itinerary` takes
   * `previous_snapshot`, and a single slot holding either would let a trip that gained an overnight
   * stop hand the itinerary endpoint the day-trip's facts. The KEY is shared on purpose — it is the
   * same trip, whichever shape the plan currently has.
   *
   * Deliberately in memory only, exactly like `facts` above. `/v1/briefings/itinerary` takes the
   * planning body and has no `trip_id`, so there is no ADR-0039 server baseline behind it — a
   * multi-day re-brief is a within-session comparison and says so by forgetting on reload. Writing
   * it to localStorage instead would be a new storage mechanism for a whole forecast's worth of
   * remembered state, and a snapshot that outlives the session is a baseline nobody can see or
   * clear.
   */
  private readonly snapshots = new Map<string, DaySnapshotModel[]>();

  /** The prior facts to send for this trip — undefined when it has never been briefed here. */
  previousFactsFor(key: string): BriefingFactsModel | undefined {
    return this.facts.get(key);
  }

  /** Store the freshly returned facts as this trip's new baseline (most-recent-wins). */
  remember(key: string, facts: BriefingFactsModel): void {
    rememberIn(this.facts, key, facts);
  }

  /**
   * The prior whole-trip snapshot to send as `previous_snapshot` — undefined on the first look at
   * this trip, which is what makes `diff: null` (nothing compared) reachable at all.
   */
  previousSnapshotFor(key: string): DaySnapshotModel[] | undefined {
    return this.snapshots.get(key);
  }

  /**
   * Store a whole-trip snapshot as this trip's new baseline.
   *
   * An EMPTY snapshot is dropped rather than stored: sending `previous_snapshot: []` next time
   * would not read as "no baseline", it would read as a trip that had no days at all, and every
   * day of the next briefing would come back as `added`.
   */
  rememberSnapshot(key: string, snapshot: readonly DaySnapshotModel[]): void {
    if (!snapshot.length) return;
    rememberIn(this.snapshots, key, [...snapshot]);
  }
}
