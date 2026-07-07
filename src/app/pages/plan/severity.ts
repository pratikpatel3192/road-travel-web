// The engine's 3-level severity scale (ADR-0002). Values match the API contract.
export type Severity = 'clear' | 'caution' | 'severe';

export const SEVERITY_COLOR: Record<Severity, string> = {
  clear: '#16a34a', // green
  caution: '#f59e0b', // amber
  severe: '#dc2626', // red
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  clear: 'Clear',
  caution: 'Caution',
  severe: 'Severe',
};

const MI_PER_M = 1 / 1609.344;

export function formatTemp(celsius: number, units: 'imperial' | 'metric'): string {
  return units === 'metric'
    ? `${Math.round(celsius)}°C`
    : `${Math.round(celsius * 1.8 + 32)}°F`;
}

export function formatDistance(meters: number, units: 'imperial' | 'metric'): string {
  return units === 'metric'
    ? `${Math.round(meters / 1000)} km`
    : `${Math.round(meters * MI_PER_M)} mi`;
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
  if (has('cloud.sun', 'partly')) return '🌤️';
  if (has('cloud', 'overcast')) return '☁️'; // includes "mostly cloudy" + night clouds
  if (has('moon')) return '🌙';
  if (has('sun', 'clear', 'fair')) return '☀️';
  return '🌡️';
}
