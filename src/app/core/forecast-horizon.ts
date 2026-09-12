/**
 * Where the forecast stops and history begins.
 *
 * Mirrors the server's `services/tiers.py` and iOS's `ForecastHorizon`. It lives in `core/` rather
 * than on the planner because two screens now ask the question — the planner, for one departure,
 * and the itinerary, for every leg of a month — and the same date must not be a forecast on one
 * screen and history on the other.
 */

/** One constant, quoted everywhere. A 10 repeated in four places is a 10 that drifts. */
export const FORECAST_HORIZON_DAYS = 10;

export type Tier = 'forecast' | 'outlook';

/** A date's calendar day as a comparable number, with the time of day discarded. */
const asDay = (d: Date): number => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Which KIND of answer a travel date can have, compared by DAY rather than by instant: a trip
 * leaving at 6pm on the tenth day is inside the window, and an hours-based comparison would call it
 * outlook for a reason no traveller could understand.
 */
export function tierFor(departure: Date, now = new Date()): Tier {
  const last = new Date(now.getTime() + FORECAST_HORIZON_DAYS * 86_400_000);
  return asDay(departure) <= asDay(last) ? 'forecast' : 'outlook';
}

/**
 * Same question for a wire date (`YYYY-MM-DD`), which is what a leg carries.
 *
 * Parsed as a LOCAL day rather than through `new Date('2026-10-03')` — that spelling is read as
 * UTC midnight, so west of Greenwich it lands on the 2nd and a leg can change tier by a day for
 * no reason the traveller could see.
 */
export function tierForDay(isoDay: string, now = new Date()): Tier | null {
  const parsed = parseIsoDay(isoDay);
  return parsed ? tierFor(parsed, now) : null;
}

/** `YYYY-MM-DD` → a Date at local midnight. `null` for anything that is not a calendar day. */
export function parseIsoDay(isoDay: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDay ?? '');
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  // Rejects 2026-02-31 and friends, which JS would otherwise roll forward into March.
  return date.getMonth() === Number(m) - 1 ? date : null;
}

/** The user's LOCAL calendar day — an instant would answer a late departure for the wrong day. */
export function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "Sat 3 Oct" — how a driver reads a date off an itinerary. */
export function dayLabel(isoDayString: string): string {
  const date = parseIsoDay(isoDayString);
  if (!date) return '';
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
