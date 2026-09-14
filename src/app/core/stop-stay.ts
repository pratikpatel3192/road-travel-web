/**
 * How long a traveller stays at a stop — a pause, or a stay, on ONE scale.
 *
 * This started as two controls: a nights number box and a "Stop for" dwell select. At zero they
 * both read as passing through, so a stop asked the same question twice and the traveller had to
 * work out which control meant what. They were never two questions. "We'll stretch our legs in
 * Amarillo" and "we'll spend three nights in Albuquerque" are the same thought at different
 * lengths, and one list of durations says so.
 *
 * It also makes the server's rule unrepresentable rather than merely unenforced: a stop is a pause
 * OR a stay, and a single selection cannot be both.
 *
 * Kept in lockstep with iOS `StopStay` — same options, same order, same words.
 */
export interface StopStay {
  /** Stable value for the <select>. */
  readonly id: string;
  /** Full label, shown in the list. */
  readonly label: string;
  readonly dwellMinutes: number;
  readonly nights: number;
}

const PAUSE_MINUTES = [15, 30, 45, 60] as const;

/**
 * Night presets thin out as they lengthen: nobody scrolls a list of 120, whole weeks are the shape
 * of a long stay, and anything stranger is a trip someone edits by hand.
 */
const STAY_NIGHTS = [1, 2, 3, 4, 5, 6, 7, 10, 14, 21, 30] as const;

/** Every option, shortest first — pause lengths, then stays. */
export const STOP_STAY_OPTIONS: readonly StopStay[] = [
  { id: 'pass', label: 'Pass through', dwellMinutes: 0, nights: 0 },
  ...PAUSE_MINUTES.map((m) => ({
    id: `m${m}`,
    label: `${m} min`,
    dwellMinutes: m,
    nights: 0,
  })),
  ...STAY_NIGHTS.map((n) => ({
    id: `n${n}`,
    label: n === 1 ? '1 night' : `${n} nights`,
    dwellMinutes: 0,
    nights: n,
  })),
];

/**
 * Read the selection back from the two stored fields.
 *
 * Nights win when both are somehow set. The server rejects that combination, so it can only arrive
 * from an older client or a hand-edited trip — and of the two, the stay is what changes the shape
 * of the itinerary, so losing it silently would be the worse mistake.
 */
export function stayIdFor(dwellMinutes: number, nights: number): string {
  if (nights > 0) {
    return STOP_STAY_OPTIONS.find((o) => o.nights === nights)?.id ?? `n${nights}`;
  }
  if (dwellMinutes > 0) {
    return STOP_STAY_OPTIONS.find((o) => o.dwellMinutes === dwellMinutes)?.id ?? `m${dwellMinutes}`;
  }
  return 'pass';
}

/** The option for a select value, or the pass-through default for one we do not know. */
export function stayById(id: string): StopStay {
  return STOP_STAY_OPTIONS.find((o) => o.id === id) ?? STOP_STAY_OPTIONS[0];
}
