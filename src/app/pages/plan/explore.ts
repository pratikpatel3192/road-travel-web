import type {
  AddStopPreviewRequest,
  AddStopPreviewResponse,
  ExploreParams,
  ExploreRequest,
  WaypointModel,
} from '@road-travel/sdk';

import type { PlaceValue } from './place-field';
import { SEVERITY_LABEL, type Severity } from './severity';
import type { DwellMinutes } from './waypoints';

/**
 * F-005 Trip Explorer helpers: the intent catalog, the per-intent refinement category chips, and
 * the pure request composition for `/v1/trips/explore` + the add-stop delta preview. Framework-free
 * (like waypoints.ts) so the composition is unit-testable. Thin client — the server probes the
 * corridor, ranks, filters and summarizes (ADR-0011/ADR-0033); no POI keys exist client-side.
 */

export type ExploreIntent = ExploreRequest['intent'];
export type ExploreRefinement = 'closer_to_halfway' | 'shorter_detour';
export type ExploreCategory = NonNullable<ExploreParams['category']>;

/** The five v1 intents, in product order. `add_stop_search` opens a query input instead. */
export interface ExploreIntentDef {
  intent: ExploreIntent;
  icon: string;
  label: string;
}

export const EXPLORE_INTENTS: readonly ExploreIntentDef[] = [
  { intent: 'passenger_stops', icon: '🧸', label: 'Stops for passengers' },
  { intent: 'food_mealtime', icon: '🍽️', label: 'Food near mealtime' },
  { intent: 'fuel_charge', icon: '⛽', label: 'Fuel / charge' },
  { intent: 'scenic', icon: '🏞️', label: 'Scenic stops' },
  { intent: 'add_stop_search', icon: '🔍', label: 'Add a stop…' },
];

/** The two server refinements — re-slice the server's cached candidates (zero provider calls). */
export const EXPLORE_REFINEMENTS: readonly { value: ExploreRefinement; label: string }[] = [
  { value: 'closer_to_halfway', label: 'Closer to halfway' },
  { value: 'shorter_detour', label: 'Shorter detour' },
];

/**
 * Single-category filter chips per intent (`params.category`) — each intent's own provider
 * categories (ADR-0033), so a chip always slices the already-fetched candidate set (cache hit).
 */
export const EXPLORE_CATEGORY_CHIPS: Record<
  ExploreIntent,
  readonly { value: ExploreCategory; label: string }[]
> = {
  passenger_stops: [
    { value: 'park', label: 'Park' },
    { value: 'playground', label: 'Playground' },
    { value: 'rest_area', label: 'Rest area' },
  ],
  food_mealtime: [
    { value: 'restaurant', label: 'Restaurant' },
    { value: 'fast_food', label: 'Fast food' },
  ],
  fuel_charge: [
    { value: 'gas_station', label: 'Gas' },
    { value: 'charging_station', label: 'EV charging' },
  ],
  scenic: [
    { value: 'tourist_attraction', label: 'Attraction' },
    { value: 'viewpoint', label: 'Viewpoint' },
  ],
  add_stop_search: [],
};

/**
 * `/v1/trips/explore` body — ALWAYS the current trip identity (origin/destination/departure +
 * the F-006 waypoints, same shape the plan request sends) plus the intent and any refinement
 * state. Params/refinements keys are omitted entirely when empty.
 */
export function buildExploreRequest(args: {
  origin: PlaceValue;
  destination: PlaceValue;
  departureAt: string;
  waypoints?: readonly WaypointModel[];
  intent: ExploreIntent;
  /** add_stop_search only — the free-text place query (server 422s without it). */
  query?: string;
  category?: ExploreCategory | null;
  refinements?: readonly ExploreRefinement[];
}): ExploreRequest {
  const body: ExploreRequest = {
    origin: args.origin,
    destination: args.destination,
    departure_at: args.departureAt,
    intent: args.intent,
  };
  if (args.waypoints?.length) body.waypoints = [...args.waypoints];
  const params: ExploreParams = {};
  if (args.intent === 'add_stop_search') params.query = (args.query ?? '').trim();
  if (args.category) params.category = args.category;
  if (Object.keys(params).length) body.params = params;
  if (args.refinements?.length) body.refinements = [...args.refinements];
  return body;
}

/**
 * `/v1/trips/explore/add-stop-preview` body: the trip AS PLANNED (same identity as above) plus the
 * candidate stop with the user's chosen dwell — the server diffs plan-without vs plan-with.
 */
export function buildAddStopPreviewRequest(args: {
  origin: PlaceValue;
  destination: PlaceValue;
  departureAt: string;
  waypoints?: readonly WaypointModel[];
  stop: PlaceValue;
  dwellMinutes: DwellMinutes;
}): AddStopPreviewRequest {
  const body: AddStopPreviewRequest = {
    origin: args.origin,
    destination: args.destination,
    departure_at: args.departureAt,
    stop: {
      name: args.stop.name,
      latitude: args.stop.latitude,
      longitude: args.stop.longitude,
      dwell_minutes: args.dwellMinutes,
    },
  };
  if (args.waypoints?.length) body.waypoints = [...args.waypoints];
  return body;
}

/** "1.2 km off-route" / "0.7 mi off-route" — one-decimal detour in the user's units. */
export function formatDetour(meters: number, units: 'imperial' | 'metric'): string {
  return units === 'metric'
    ? `${(meters / 1000).toFixed(1)} km off-route`
    : `${(meters / 1609.344).toFixed(1)} mi off-route`;
}

/** "weather exposure 4 → 2" / "weather exposure unchanged" (server ADR-0032 scores). */
export function exposureDeltaLabel(p: AddStopPreviewResponse): string {
  return p.exposure_before === p.exposure_after
    ? 'weather exposure unchanged'
    : `weather exposure ${p.exposure_before} → ${p.exposure_after}`;
}

/** "worst stretch Caution → Severe" / "worst stretch unchanged" for the preview confirm. */
export function worstDeltaLabel(p: AddStopPreviewResponse): string {
  return p.worst_before === p.worst_after
    ? 'worst stretch unchanged'
    : `worst stretch ${SEVERITY_LABEL[p.worst_before as Severity]} → ${SEVERITY_LABEL[p.worst_after as Severity]}`;
}

/** "Park" from `park`, "Rest area" from `rest_area` — the card's category badge text. */
export function categoryLabel(category: string | undefined): string {
  if (!category) return '';
  const words = category.replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
