import type {
  BriefingResponse,
  ItineraryBriefingResponse,
  PlanItineraryResponse,
  PlanTripResponse,
  SaveTripSnapshotRequest,
  TripSnapshotResponse,
} from '@road-travel/sdk';

/**
 * A saved trip's stored result — what opening it from My Trips shows instead of re-planning.
 *
 * Opening a trip used to re-plan it: a route, a forecast and a briefing fetched fresh every time,
 * just to look at something the traveller had already seen. The server now keeps the last result per
 * trip (`PUT/GET /v1/trips/{id}/snapshot`) and each client renders that, dated, with a Refresh.
 *
 * **The payload is shared with iOS, byte for byte.** Either client must be able to open what the
 * other saved, so `payload` is nothing but the SERVER's own response bodies, unmodified and in their
 * wire (snake_case) form:
 *
 * - kind `single`:    `{ "plan": PlanTripResponse, "briefing": BriefingResponse | null }`
 * - kind `itinerary`: `{ "itinerary": PlanItineraryResponse, "briefing": ItineraryBriefingResponse | null }`
 *
 * No client-only fields go inside it. Anything this client cannot decode is treated exactly like no
 * snapshot at all — the trip is planned as it always was — so a newer or broken payload can cost a
 * round trip, never a crash or a half-drawn result.
 */
export const SNAPSHOT_SCHEMA_VERSION = 1;

/**
 * Older than this and the snapshot is not shown at all: the trip is re-planned on open. Two days is
 * the traveller's own call — past it a forecast has moved enough that showing it, even dated, invites
 * someone to read old weather as current.
 */
export const SNAPSHOT_MAX_AGE_MS = 48 * 3_600_000;

type ShownPlan = PlanTripResponse | PlanItineraryResponse;
type ShownBriefing = BriefingResponse | ItineraryBriefingResponse;

/** The result on screen, as the server returned it — what a snapshot is built from. */
export interface SnapshotSource {
  result: ShownPlan;
  briefing: ShownBriefing | null;
  /** When the plan response arrived (ISO, UTC). */
  plannedAt: string;
  /** The departure the plan was asked for (ISO, UTC) — including any scrubbed offset. */
  departureAt: string;
  /**
   * The trip definition (endpoints + form departure + stops) this result was planned for. The save
   * that yields the revision reads the form a debounce later; if the form has moved on by then the
   * revision describes a different trip from the payload, and the server has no way to tell.
   */
  definitionKey: string;
}

/** A snapshot this client understood, ready to render. */
export interface DecodedSnapshot {
  kind: 'single' | 'itinerary';
  result: ShownPlan;
  briefing: ShownBriefing | null;
  plannedAt: string;
  departureAt: string;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isString = (v: unknown): v is string => typeof v === 'string';
const isDate = (v: unknown): v is string => isString(v) && !Number.isNaN(Date.parse(v));

/** A one-day `PlanTripResponse` — every field the map, timeline and summary dereference. */
function isPlan(v: unknown): v is PlanTripResponse {
  return (
    isObject(v) &&
    isObject(v['origin']) &&
    isObject(v['destination']) &&
    isDate(v['departure_at']) &&
    isDate(v['arrival_at']) &&
    isNumber(v['distance_meters']) &&
    isNumber(v['duration_seconds']) &&
    isString(v['worst_severity']) &&
    Array.isArray(v['route_coordinates']) &&
    Array.isArray(v['segments']) &&
    Array.isArray(v['samples']) &&
    v['samples'].every((s) => isObject(s) && isNumber(s['distance_from_start_meters']))
  );
}

function isItinerary(v: unknown): v is PlanItineraryResponse {
  return (
    isObject(v) &&
    Array.isArray(v['days']) &&
    v['days'].length > 0 &&
    v['days'].every(
      (d) => isObject(d) && isNumber(d['ordinal']) && (d['plan'] == null || isPlan(d['plan'])),
    )
  );
}

function isBriefing(v: unknown): v is BriefingResponse {
  return (
    isObject(v) &&
    isString(v['text']) &&
    isObject(v['facts']) &&
    Array.isArray(v['facts']['hazards']) &&
    !('rollup' in v)
  );
}

function isItineraryBriefing(v: unknown): v is ItineraryBriefingResponse {
  return isObject(v) && isString(v['text']) && isObject(v['rollup']) && Array.isArray(v['days']);
}

/**
 * Decode a stored snapshot, or null when this client cannot use it — an unknown schema version, a
 * missing result, or a shape that does not match its kind. Null is handled exactly like
 * `snapshot_not_found`.
 *
 * A present-but-malformed briefing rejects the WHOLE snapshot rather than rendering the plan without
 * it: a result missing a card the traveller saw last time reads as the app having lost it. An ABSENT
 * `briefing` key is read as null, though this client always writes the key — an encoder that omits
 * nulls (Swift's synthesized Codable does) must not turn a valid snapshot into a re-plan.
 */
export function decodeTripSnapshot(res: TripSnapshotResponse | unknown): DecodedSnapshot | null {
  if (!isObject(res)) return null;
  if (res['schema_version'] !== SNAPSHOT_SCHEMA_VERSION) return null;
  if (!isDate(res['planned_at']) || !isDate(res['departure_at'])) return null;
  const payload = res['payload'];
  if (!isObject(payload)) return null;
  const briefing = payload['briefing'] ?? null;
  const common = { plannedAt: res['planned_at'], departureAt: res['departure_at'] };

  if (res['kind'] === 'single') {
    if (!isPlan(payload['plan'])) return null;
    if (briefing !== null && !isBriefing(briefing)) return null;
    return { kind: 'single', result: payload['plan'], briefing, ...common };
  }
  if (res['kind'] === 'itinerary') {
    if (!isItinerary(payload['itinerary'])) return null;
    if (briefing !== null && !isItineraryBriefing(briefing)) return null;
    return { kind: 'itinerary', result: payload['itinerary'], briefing, ...common };
  }
  return null;
}

/**
 * The PUT body for the result on screen. The payload keys follow the shared contract above; a
 * briefing of the other kind (a one-day briefing left under a result that became multi-day) is
 * written as null rather than stored under a key that promises something else.
 */
export function buildSnapshotRequest(
  source: SnapshotSource,
  tripRevision: string,
): SaveTripSnapshotRequest {
  const common = {
    schema_version: SNAPSHOT_SCHEMA_VERSION,
    planned_at: source.plannedAt,
    departure_at: source.departureAt,
    trip_revision: tripRevision,
  };
  if ('days' in source.result) {
    const briefing = source.briefing && 'rollup' in source.briefing ? source.briefing : null;
    return { ...common, kind: 'itinerary', payload: { itinerary: source.result, briefing } };
  }
  const briefing = source.briefing && !('rollup' in source.briefing) ? source.briefing : null;
  return { ...common, kind: 'single', payload: { plan: source.result, briefing } };
}

/** Strictly MORE than two days old — a snapshot exactly 48 hours old is still shown. */
export function isSnapshotExpired(plannedAt: string, now: number): boolean {
  return now - Date.parse(plannedAt) > SNAPSHOT_MAX_AGE_MS;
}

export function departureHasPassed(departureAt: string, now: number): boolean {
  return Date.parse(departureAt) < now;
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;

/**
 * "Forecast from 3 hours ago". Floors, so "1 hour ago" means at least an hour; a planned_at slightly
 * in the future (another device's clock) reads as fresh rather than as a negative age.
 */
export function forecastAgeLabel(plannedAt: string, now: number): string {
  const minutes = Math.floor(Math.max(0, now - Date.parse(plannedAt)) / 60_000);
  if (minutes < 1) return 'Forecast from less than a minute ago';
  if (minutes < 60) return `Forecast from ${plural(minutes, 'minute')} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Forecast from ${plural(hours, 'hour')} ago`;
  return `Forecast from ${plural(Math.floor(hours / 24), 'day')} ago`;
}
