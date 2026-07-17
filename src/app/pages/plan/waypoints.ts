import type { BriefingRequest, PlanTripRequest, WaypointModel } from '@road-travel/sdk';

import type { PlaceValue } from './place-field';

/**
 * F-006 multi-stop helpers: the draft stop rows the planner edits, and the pure request-building
 * that turns them into the contract's `waypoints` (thin client — the server routes, samples and
 * shifts every ETA by dwell; ADR-0011). Kept framework-free so the composition is unit-testable.
 */

/** The product's dwell presets (minutes). Anything else is rejected server-side (422). */
export type DwellMinutes = 0 | 15 | 30 | 45 | 60;
export const DWELL_PRESETS: readonly DwellMinutes[] = [0, 15, 30, 45, 60];

/** Product cap — mirrors the server's `MAX_WAYPOINTS` (a 4th stop is a 422; ADR-0031). */
export const MAX_STOPS = 3;

/** One editable stop row: the place may still be empty (mid-typing) — only complete rows plan. */
export interface StopDraft {
  /** Stable row identity for tracking through reorders. */
  id: number;
  place: PlaceValue | null;
  dwellMinutes: DwellMinutes;
}

let stopSeq = 0;
export function newStop(place: PlaceValue | null = null, dwellMinutes: DwellMinutes = 0): StopDraft {
  return { id: ++stopSeq, place, dwellMinutes };
}

/** Coerce a server/storage dwell value onto the preset scale (defensive; server validates too). */
export function normalizeDwell(minutes: number | undefined | null): DwellMinutes {
  return (DWELL_PRESETS as readonly number[]).includes(minutes ?? 0)
    ? ((minutes ?? 0) as DwellMinutes)
    : 0;
}

/** The complete (place-selected) rows as ordered contract waypoints; incomplete rows don't plan. */
export function toWaypoints(stops: readonly StopDraft[]): WaypointModel[] {
  return stops
    .filter((s): s is StopDraft & { place: PlaceValue } => !!s.place)
    .slice(0, MAX_STOPS)
    .map((s) => ({
      name: s.place.name,
      latitude: s.place.latitude,
      longitude: s.place.longitude,
      dwell_minutes: s.dwellMinutes,
    }));
}

/** Stage saved/staged waypoints back into editable rows (opening a saved multi-stop trip). */
export function fromWaypoints(waypoints: readonly WaypointModel[] | undefined | null): StopDraft[] {
  return (waypoints ?? [])
    .slice(0, MAX_STOPS)
    .map((w) =>
      newStop(
        { name: w.name, latitude: w.latitude, longitude: w.longitude },
        normalizeDwell(w.dwell_minutes),
      ),
    );
}

/**
 * Trip-identity key extension for briefing staleness (F-001 US-3 / ADR-0031 §3): includes every
 * waypoint AND its dwell, so any stop add/remove/reorder/dwell change yields a different key and
 * invalidates a shown briefing. Empty = legacy A→B identity.
 */
export function waypointsKey(waypoints: readonly WaypointModel[]): string {
  return waypoints
    .map((w) => `${w.name}@${w.latitude},${w.longitude}:${w.dwell_minutes ?? 0}`)
    .join('|');
}

/** `/v1/trips/plan` body — waypoints ride along only when there are any (0 stops ≡ legacy A→B). */
export function buildPlanRequest(args: {
  origin: PlaceValue;
  destination: PlaceValue;
  departureAt: string;
  waypoints?: readonly WaypointModel[];
}): PlanTripRequest {
  const body: PlanTripRequest = {
    origin: args.origin,
    destination: args.destination,
    departure_at: args.departureAt,
  };
  if (args.waypoints?.length) body.waypoints = [...args.waypoints];
  return body;
}

/** `/v1/briefings` body — MUST carry the same waypoints as the plan (the briefing narrates them). */
export function buildBriefingRequest(args: {
  origin: PlaceValue;
  destination: PlaceValue;
  departureAt: string;
  units: 'imperial' | 'metric';
  waypoints?: readonly WaypointModel[];
}): BriefingRequest {
  const body: BriefingRequest = {
    origin: args.origin,
    destination: args.destination,
    departure_at: args.departureAt,
    units: args.units,
  };
  if (args.waypoints?.length) body.waypoints = [...args.waypoints];
  return body;
}

/** "Pass through" / "15 min stop" — the shared dwell label (timeline cells + pickers). */
export function formatDwell(minutes: number): string {
  return minutes <= 0 ? 'Pass through' : `${minutes} min stop`;
}
