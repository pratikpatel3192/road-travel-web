import rawVectors from '../../../../road-travel-docs/test-vectors/itinerary.vectors.json';

import { type DerivedLeg, deriveLegs, totalDays } from './itinerary';

/**
 * The shared `itinerary.vectors.json` oracle, imported straight from road-travel-docs (repos side
 * by side) exactly as the F-012 trip-key vectors are — so Python, TypeScript and Swift assert one
 * file rather than three copies of an answer.
 *
 * The derivation is implemented three times because all three clients have to show the days while
 * the user is still typing. That is precisely the shape of thing that drifts silently: an
 * off-by-one in "date + 1 travel day + nights" is invisible on a two-day trip and puts a month-long
 * one's forecast on the wrong week. This suite is what makes that fail loudly.
 */

interface VectorPlace {
  name: string;
}

interface VectorWaypoint extends VectorPlace {
  nights: number;
  dwellMinutes: number;
  departureTime: string | null;
}

interface VectorCase {
  name: string;
  input: {
    origin: VectorPlace;
    destination: VectorPlace;
    waypoints: VectorWaypoint[];
    departureDate: string | null;
    departureTime: string | null;
  };
  expected: {
    legs: {
      ordinal: number;
      originName: string;
      destinationName: string;
      waypointNames: string[];
      travelDate: string | null;
      departureTime: string | null;
      nightsAtDestination: number;
    }[];
    totalDays: number;
  };
}

/**
 * A checked annotation rather than a cast: if the shared file grows a field or changes a type, this
 * line stops compiling, which is the warning we want. `as` would swallow exactly that.
 */
const vectors: { schemaVersion: number; cases: VectorCase[] } = rawVectors;

/** The comparable shape the vectors speak — names only, because a name is what a vector can pin. */
const comparable = (leg: DerivedLeg<VectorPlace>) => ({
  ordinal: leg.ordinal,
  originName: leg.origin.name,
  destinationName: leg.destination.name,
  waypointNames: leg.waypoints.map((w) => w.name),
  travelDate: leg.travelDate,
  departureTime: leg.departureTime,
  nightsAtDestination: leg.nightsAtDestination,
});

describe('shared itinerary vectors (Python/TS/Swift parity)', () => {
  it('reads the schema this suite was written against', () => {
    // A bumped schema means the file says something new; passing silently against the old reading
    // is how a port drifts while its tests stay green.
    expect(vectors.schemaVersion).toBe(1);
    expect(vectors.cases.length).toBeGreaterThanOrEqual(6);
  });

  it.each(vectors.cases.map((c) => [c.name, c] as const))('%s', (_name, testCase) => {
    const legs = deriveLegs<VectorPlace>({
      origin: testCase.input.origin,
      destination: testCase.input.destination,
      stops: testCase.input.waypoints.map((w) => ({
        place: w,
        nights: w.nights,
        departureTime: w.departureTime,
      })),
      departureDate: testCase.input.departureDate,
      departureTime: testCase.input.departureTime,
    });

    expect(legs.map(comparable)).toEqual(testCase.expected.legs);
    expect(totalDays(legs)).toBe(testCase.expected.totalDays);
  });

  it('covers the cases that are easy to get wrong', () => {
    // Named rather than counted: these three are the ones a plausible-looking port gets wrong —
    // a dwell treated as a stay, a per-stop time ignored in favour of the trip's, and dates
    // invented for a trip that has none.
    const names = vectors.cases.map((c) => c.name);
    expect(names).toContain('lunch_stop_stays_inside_its_leg');
    expect(names).toContain('per_stop_departure_times');
    expect(names).toContain('undated_trip_derives_undated_days');
  });
});
