import { describe, expect, it } from 'vitest';

/**
 * The autocomplete proximity bias, as a pure function of the three inputs the planner has.
 *
 * Photon's unbiased global ranking answers "san" with Poland, San Marino, Chile and Costa Rica.
 * That is what the planner showed to anyone who typed a STOP before filling in either endpoint,
 * because the bias chain ended at `null`. iOS never had the problem: MKLocalSearchCompleter
 * defaults its region to where the user is.
 */
type Pt = { latitude: number; longitude: number } | null;

function searchBias(origin: Pt, destination: Pt, userLocation: Pt): Pt {
  if (origin && destination) {
    return {
      latitude: (origin.latitude + destination.latitude) / 2,
      longitude: (origin.longitude + destination.longitude) / 2,
    };
  }
  return origin ?? destination ?? userLocation;
}

const AUSTIN = { latitude: 30.27, longitude: -97.74 };
const MONTANA = { latitude: 47.4, longitude: -109.6 };
const HERE = { latitude: 30.5, longitude: -97.8 };

describe('stop autocomplete proximity bias', () => {
  it('uses the route corridor when both endpoints are set', () => {
    const b = searchBias(AUSTIN, MONTANA, null)!;
    expect(b.latitude).toBeCloseTo(38.835, 2);
    expect(b.longitude).toBeCloseTo(-103.67, 2);
  });

  it('falls back to whichever endpoint is set', () => {
    expect(searchBias(AUSTIN, null, null)).toEqual(AUSTIN);
    expect(searchBias(null, MONTANA, null)).toEqual(MONTANA);
  });

  it('falls back to where the user is when neither endpoint is set', () => {
    // The regression: this returned null, so a stop typed before either endpoint got Photon's
    // unbiased global ranking — other continents first.
    expect(searchBias(null, null, HERE)).toEqual(HERE);
  });

  it('is null only when the planner knows nothing at all', () => {
    expect(searchBias(null, null, null)).toBeNull();
  });
});
