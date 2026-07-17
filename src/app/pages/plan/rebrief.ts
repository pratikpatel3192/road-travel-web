import type { BriefingFactsModel, WaypointModel } from '@road-travel/sdk';

import type { PlaceValue } from './place-field';
import { waypointsKey } from './waypoints';

/**
 * F-001 v2 (US-11) re-brief helpers: remember the last briefing's `facts` per trip identity so a
 * re-generated briefing for the SAME trip carries `previous_facts` (the server then returns a
 * grounded `diff` and leads the prose with what changed). Trip identity is endpoints + departure +
 * the F-006 waypoints/dwell key — change ANY of those and it is a different trip, so no
 * `previous_facts` is sent (a diff against a different trip would be meaningless).
 * Framework-free, like waypoints.ts, so the send/don't-send decision is unit-testable.
 */

/** The full trip identity a briefing was generated for (extends ADR-0031 §3 with endpoints+departure). */
export function tripIdentityKey(args: {
  origin: PlaceValue;
  destination: PlaceValue;
  departureAt: string;
  waypoints?: readonly WaypointModel[];
}): string {
  const place = (p: PlaceValue) => `${p.name}@${p.latitude},${p.longitude}`;
  return [
    place(args.origin),
    place(args.destination),
    args.departureAt,
    waypointsKey(args.waypoints ?? []),
  ].join('>');
}

/**
 * Single-slot memory of the last briefing's facts + the trip identity they were generated for.
 * `previousFactsFor` yields the facts ONLY when the identity matches — the caller puts the result
 * straight into the request body (undefined = key omitted).
 */
export class BriefingMemory {
  private key: string | null = null;
  private facts: BriefingFactsModel | null = null;

  /** The prior facts to send when re-briefing `key` — undefined when it's a different trip. */
  previousFactsFor(key: string): BriefingFactsModel | undefined {
    return this.key === key && this.facts ? this.facts : undefined;
  }

  /** Store the freshly returned facts as the new baseline for `key`. */
  remember(key: string, facts: BriefingFactsModel): void {
    this.key = key;
    this.facts = facts;
  }
}
