// The engine's severity scale (ADR-0002), widened from three levels to five. Values match the API
// contract and are ordered worst-last: `high` slots between caution and severe, `extreme` above
// severe. The three original values keep exactly the meaning they always had.
//
//   clear   — drive normally
//   caution — slow down; conditions are noticeable
//   high    — changes how you should drive; avoid the highway if you can
//   severe  — avoid unnecessary driving
//   extreme — do not drive into this (an official warning is in force, or hail/tornado-grade)
export type Severity = 'clear' | 'caution' | 'high' | 'severe' | 'extreme';

/** Worst-last rank, for comparisons. Mirrors iOS `Severity.rank`. */
export const SEVERITY_RANK: Record<Severity, number> = {
  clear: 0,
  caution: 1,
  high: 2,
  severe: 3,
  extreme: 4,
};

/**
 * Every level, worst-last. Iterate this rather than re-listing the union — a sixth level added to
 * `Severity` then fails to compile here instead of silently missing from a table somewhere.
 */
export const SEVERITY_LEVELS = ['clear', 'caution', 'high', 'severe', 'extreme'] as const;

// Organic 3.1.0 hues (branding-3.1.0 tokens): all-clear = sage, hazard = terracotta ramp — except
// `extreme`, which deliberately leaves the ramp for red. Four steps of one brown ramp would read as
// "more of the same"; an official warning in force is a different KIND of statement, and the colour
// says so. Values are the LIGHT theme's (this map is static; the --sev-* variables in
// src/styles.css carry the dark flip). Mirrors iOS Color.rtSeverity hex-for-hex — keep both in sync.
export const SEVERITY_COLOR: Record<Severity, string> = {
  clear: '#7a8a5e', // sage
  caution: '#f6a06b', // terracotta accent-400
  high: '#d97b3c', // terracotta, between accent-400 and accent-600
  severe: '#b2622d', // terracotta accent-600
  extreme: '#8c1d18', // off-ramp red — warning-grade, not another brown
};

/** A stretch or point the forecast does not reach. Grey, never the calm sage of "clear". */
export const UNKNOWN_COLOR = '#a19786';
export const UNKNOWN_LABEL = 'No forecast yet';

export const SEVERITY_LABEL: Record<Severity, string> = {
  clear: 'Clear',
  caution: 'Caution',
  high: 'High',
  severe: 'Severe',
  extreme: 'Extreme',
};

/**
 * The fail-safe reading of a severity the client does not recognise — a level the server added that
 * this build predates. NOT 'clear': an unknown word is the one case where guessing calm is the
 * dangerous guess, because a server that grew the scale grew it at the bad end. Caution is the
 * mildest level that still says "look at this", so an unrecognised value degrades to it.
 *
 * This is for an unrecognised value only. A genuinely ABSENT forecast is a different thing and gets
 * UNKNOWN_COLOR / UNKNOWN_LABEL — "nobody knows yet" is not "be a bit careful".
 */
export const SEVERITY_FALLBACK: Severity = 'caution';

/** Narrow an API string to a known level, or null when this build does not recognise it. */
export function toSeverity(value: string | null | undefined): Severity | null {
  return value != null && value in SEVERITY_RANK ? (value as Severity) : null;
}

/**
 * The level to RENDER for an API value: the value itself when known, else the fail-safe. Use this
 * instead of `x as Severity` — the cast is what lets a new server level slip through silently.
 */
export function severityOrFallback(value: string | null | undefined): Severity {
  return toSeverity(value) ?? SEVERITY_FALLBACK;
}

/** Caution-or-worse: the levels that are worth interrupting the driver about. */
export function isHazard(sev: Severity | null | undefined): boolean {
  return sev != null && SEVERITY_RANK[sev] >= SEVERITY_RANK.caution;
}

const MI_PER_M = 1 / 1609.344;

export function formatTemp(celsius: number, units: 'imperial' | 'metric'): string {
  return units === 'metric' ? `${Math.round(celsius)}°C` : `${Math.round(celsius * 1.8 + 32)}°F`;
}

export function formatDistance(meters: number, units: 'imperial' | 'metric'): string {
  return units === 'metric'
    ? `${Math.round(meters / 1000)} km`
    : `${Math.round(meters * MI_PER_M)} mi`;
}

/** "6 h 20 m" / "45 m" — compact duration for the trip summary (drive + stops; F-006). */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h <= 0) return `${m} m`;
  return m > 0 ? `${h} h ${m} m` : `${h} h`;
}

export function formatWind(kph: number, units: 'imperial' | 'metric'): string {
  return units === 'metric' ? `${Math.round(kph)} km/h` : `${Math.round(kph * 0.621371)} mph`;
}

/**
 * A weather-type emoji for a milestone, derived from the backend's `condition_symbol` (WeatherKit SF
 * Symbol name, e.g. "cloud.sun.fill") — the same field the iOS timeline icons come from — with the
 * `condition_text` as a fallback. Keeps web and mobile representing the same conditions. Day/night is
 * already reflected in the symbol WeatherKit returns (sun.* vs moon.*).
 */
export function weatherEmoji(symbol?: string, conditionText?: string): string {
  const s = (symbol ?? '').toLowerCase();
  const t = (conditionText ?? '').toLowerCase();
  const has = (...keys: string[]): boolean => keys.some((k) => s.includes(k) || t.includes(k));

  if (has('tornado')) return '🌪️';
  if (has('hurricane', 'tropicalstorm')) return '🌀';
  if (has('bolt', 'thunder')) return '⛈️';
  if (has('snow', 'sleet', 'flurr', 'blizzard', 'wintry')) return '🌨️';
  if (has('hail')) return '🧊';
  if (has('heavyrain', 'rain', 'drizzle', 'shower')) return '🌧️';
  if (has('fog', 'haze', 'mist', 'smoke')) return '🌫️';
  if (has('wind', 'breez')) return '💨';
  // ADR-0027: night symbols must never render a sun — check cloud.moon BEFORE the 'partly' text
  // fallback (night partly-cloudy has conditionText "Partly Cloudy" but symbol cloud.moon.fill).
  if (has('cloud.moon')) return '☁️';
  if (has('moon.stars')) return '🌙';
  if (has('cloud.sun', 'partly')) return '🌤️';
  if (has('cloud', 'overcast')) return '☁️'; // includes "mostly cloudy" + night clouds
  if (has('moon')) return '🌙';
  if (has('sun', 'clear', 'fair')) return '☀️';
  return '🌡️';
}

/**
 * The Lucide icon name for a milestone (Organic 3.1.0 — one icon set everywhere, matching the
 * iOS `weatherLucide`). SAME decision order as `weatherEmoji` above, including the ADR-0027
 * night rule; render via `<app-icon>` (src/app/ui/icon.ts).
 */
export function weatherIcon(symbol?: string, conditionText?: string): string {
  const s = (symbol ?? '').toLowerCase();
  const t = (conditionText ?? '').toLowerCase();
  const has = (...keys: string[]): boolean => keys.some((k) => s.includes(k) || t.includes(k));

  if (has('tornado')) return 'tornado';
  if (has('hurricane', 'tropicalstorm')) return 'waves';
  if (has('bolt', 'thunder')) return 'cloud-lightning';
  if (has('snow', 'sleet', 'flurr', 'blizzard', 'wintry')) return 'cloud-snow';
  if (has('hail')) return 'cloud-snow';
  if (has('heavyrain', 'rain', 'shower')) return 'cloud-rain';
  if (has('drizzle')) return 'cloud-drizzle';
  if (has('fog', 'haze', 'mist', 'smoke')) return 'cloud-fog';
  if (has('wind', 'breez')) return 'wind';
  if (has('cloud.moon')) return 'cloud-moon';
  if (has('moon.stars')) return 'moon-star';
  if (has('cloud.sun', 'partly')) return 'cloud-sun';
  if (has('cloud', 'overcast')) return 'cloud';
  if (has('moon')) return 'moon';
  if (has('sun', 'clear', 'fair')) return 'sun';
  return 'thermometer';
}
