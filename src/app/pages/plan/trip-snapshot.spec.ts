import { describe, expect, it } from 'vitest';

import {
  SNAPSHOT_SCHEMA_VERSION,
  buildSnapshotRequest,
  decodeTripSnapshot,
  departureHasPassed,
  forecastAgeLabel,
  isSnapshotExpired,
} from './trip-snapshot';

const NOW = Date.parse('2026-09-15T12:00:00Z');
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const plan = {
  origin: { name: 'Chicago, IL', latitude: 41.88, longitude: -87.63 },
  destination: { name: 'Dallas, TX', latitude: 32.78, longitude: -96.8 },
  departure_at: '2026-09-16T13:00:00Z',
  arrival_at: '2026-09-17T03:00:00Z',
  distance_meters: 1_500_000,
  duration_seconds: 50_400,
  worst_severity: 'caution',
  route_coordinates: [],
  samples: [{ index: 0, distance_from_start_meters: 0 }],
  segments: [],
  meta: { sample_count: 1, segment_count: 0, route_point_count: 0, provider_mode: 'mock' },
};
const briefing = { text: 'Rain.', facts: { hazards: [] }, model: 'template', claims: [] };
const itinerary = {
  days: [
    { ordinal: 0, plan },
    { ordinal: 1, plan: null, beyond_forecast: true },
  ],
};
const tripBriefing = { text: 'Two days.', days: [], rollup: { partly_unknown: true }, model: 't' };

const stored = (over: Record<string, unknown> = {}) => ({
  kind: 'single',
  schema_version: 1,
  planned_at: ago(3 * HOUR),
  departure_at: '2026-09-16T13:00:00Z',
  updated_at: ago(3 * HOUR),
  payload: { plan, briefing },
  ...over,
});

describe('trip snapshot — the payload shared with iOS', () => {
  it('is schema version 1', () => {
    expect(SNAPSHOT_SCHEMA_VERSION).toBe(1);
  });

  it('writes a one-day trip as { plan, briefing } — the server bodies, untouched', () => {
    const body = buildSnapshotRequest(
      {
        result: plan as never,
        briefing: briefing as never,
        plannedAt: '2026-09-15T09:00:00.000Z',
        departureAt: '2026-09-16T13:00:00.000Z',
        definitionKey: 'k',
      },
      'rev-1',
    );
    // Exact equality: a client-only field anywhere in here would be one iOS cannot read back.
    expect(body).toEqual({
      kind: 'single',
      schema_version: 1,
      planned_at: '2026-09-15T09:00:00.000Z',
      departure_at: '2026-09-16T13:00:00.000Z',
      trip_revision: 'rev-1',
      payload: { plan, briefing },
    });
    expect(Object.keys(body.payload)).toEqual(['plan', 'briefing']);
  });

  it('writes a multi-day trip as { itinerary, briefing }', () => {
    const body = buildSnapshotRequest(
      {
        result: itinerary as never,
        briefing: tripBriefing as never,
        plannedAt: 'p',
        departureAt: 'd',
        definitionKey: 'k',
      },
      'rev-1',
    );
    expect(body.kind).toBe('itinerary');
    expect(body.payload).toEqual({ itinerary, briefing: tripBriefing });
  });

  it('writes the briefing key as null — present, not omitted — when there is none', () => {
    const body = buildSnapshotRequest(
      {
        result: plan as never,
        briefing: null,
        plannedAt: 'p',
        departureAt: 'd',
        definitionKey: 'k',
      },
      'r',
    );
    expect(body.payload).toEqual({ plan, briefing: null });
    expect('briefing' in body.payload).toBe(true);
  });

  it('never stores a briefing under the other kind’s key', () => {
    const body = buildSnapshotRequest(
      {
        result: itinerary as never,
        briefing: briefing as never,
        plannedAt: 'p',
        departureAt: 'd',
        definitionKey: 'k',
      },
      'r',
    );
    expect(body.payload).toEqual({ itinerary, briefing: null });
  });

  it('round-trips both kinds through the decoder', () => {
    expect(decodeTripSnapshot(stored())).toEqual({
      kind: 'single',
      result: plan,
      briefing,
      plannedAt: ago(3 * HOUR),
      departureAt: '2026-09-16T13:00:00Z',
    });
    const multi = decodeTripSnapshot(
      stored({ kind: 'itinerary', payload: { itinerary, briefing: tripBriefing } }),
    );
    expect(multi?.kind).toBe('itinerary');
    expect(multi?.result).toEqual(itinerary);
    expect(multi?.briefing).toEqual(tripBriefing);
  });

  it('reads an omitted briefing key as no briefing (an encoder that drops nulls)', () => {
    expect(decodeTripSnapshot(stored({ payload: { plan } }))?.briefing).toBeNull();
  });

  it.each([
    ['not an object', null],
    ['an unknown schema version', stored({ schema_version: 2 })],
    ['a missing schema version', stored({ schema_version: undefined })],
    ['an unknown kind', stored({ kind: 'outlook' })],
    ['no payload', stored({ payload: undefined })],
    ['a missing plan', stored({ payload: { briefing } })],
    ['the itinerary key on a single snapshot', stored({ payload: { itinerary, briefing: null } })],
    ['a plan without samples', stored({ payload: { plan: { ...plan, samples: undefined } } })],
    ['a sample that is not an object', stored({ payload: { plan: { ...plan, samples: [3] } } })],
    ['a briefing without facts', stored({ payload: { plan, briefing: { text: 'x' } } })],
    ['a trip briefing on a single snapshot', stored({ payload: { plan, briefing: tripBriefing } })],
    [
      'an itinerary with no days',
      stored({ kind: 'itinerary', payload: { itinerary: { days: [] } } }),
    ],
    [
      'an itinerary day with a broken plan',
      stored({ kind: 'itinerary', payload: { itinerary: { days: [{ ordinal: 0, plan: {} }] } } }),
    ],
    [
      'a day briefing on an itinerary snapshot',
      stored({ kind: 'itinerary', payload: { itinerary, briefing } }),
    ],
    ['an unparseable planned_at', stored({ planned_at: 'yesterday' })],
  ])('cannot decode %s — which is handled as no snapshot', (_label, input) => {
    expect(decodeTripSnapshot(input)).toBeNull();
  });
});

describe('trip snapshot — how old is too old', () => {
  it('shows a snapshot exactly two days old', () => {
    expect(isSnapshotExpired(ago(48 * HOUR), NOW)).toBe(false);
  });
  it('re-plans one a minute past two days', () => {
    expect(isSnapshotExpired(ago(48 * HOUR + MINUTE), NOW)).toBe(true);
  });
  it('shows one from a few hours ago', () => {
    expect(isSnapshotExpired(ago(3 * HOUR), NOW)).toBe(false);
  });
  it('knows when the departure has passed', () => {
    expect(departureHasPassed(ago(MINUTE), NOW)).toBe(true);
    expect(departureHasPassed(new Date(NOW + MINUTE).toISOString(), NOW)).toBe(false);
  });
});

describe('trip snapshot — the age, in words', () => {
  it.each([
    [0, 'Forecast from less than a minute ago'],
    [59_000, 'Forecast from less than a minute ago'],
    [MINUTE, 'Forecast from 1 minute ago'],
    [2 * MINUTE, 'Forecast from 2 minutes ago'],
    [59 * MINUTE, 'Forecast from 59 minutes ago'],
    [HOUR, 'Forecast from 1 hour ago'],
    [HOUR + 59 * MINUTE, 'Forecast from 1 hour ago'],
    [2 * HOUR, 'Forecast from 2 hours ago'],
    [3 * HOUR, 'Forecast from 3 hours ago'],
    [23 * HOUR + 59 * MINUTE, 'Forecast from 23 hours ago'],
    [24 * HOUR, 'Forecast from 1 day ago'],
    [47 * HOUR, 'Forecast from 1 day ago'],
    [48 * HOUR, 'Forecast from 2 days ago'],
  ])('%i ms old reads "%s"', (age, label) => {
    expect(forecastAgeLabel(ago(age), NOW)).toBe(label);
  });

  it('reads a planned_at slightly in the future (another clock) as fresh, not negative', () => {
    expect(forecastAgeLabel(new Date(NOW + 2 * MINUTE).toISOString(), NOW)).toBe(
      'Forecast from less than a minute ago',
    );
  });
});
