export type ClientOptions = {
    baseUrl: `${string}://${string}` | (string & {});
};
/**
 * AddStopPreviewRequest
 *
 * F-005 add-a-stop → F-006 delta preview: the trip as planned + the candidate stop.
 */
export type AddStopPreviewRequest = {
    origin: PlaceModel;
    destination: PlaceModel;
    /**
     * Departure At
     */
    departure_at: string;
    /**
     * Waypoints
     */
    waypoints?: Array<WaypointModel>;
    /**
     * Step Meters
     */
    step_meters?: number | null;
    stop: WaypointModel;
};
/**
 * AddStopPreviewResponse
 */
export type AddStopPreviewResponse = {
    /**
     * Added Seconds
     *
     * Driving-time delta (dwell excluded).
     */
    added_seconds: number;
    /**
     * Added Meters
     */
    added_meters: number;
    /**
     * Dwell Seconds
     *
     * The stop's own dwell (shifts arrival too).
     */
    dwell_seconds: number;
    /**
     * Arrival Before
     */
    arrival_before: string;
    /**
     * Arrival After
     */
    arrival_after: string;
    /**
     * Exposure Before
     *
     * Severity exposure score (ADR-0032 weights).
     */
    exposure_before: number;
    /**
     * Exposure After
     */
    exposure_after: number;
    /**
     * Worst Before
     */
    worst_before: 'clear' | 'caution' | 'high' | 'severe' | 'extreme';
    /**
     * Worst After
     */
    worst_after: 'clear' | 'caution' | 'high' | 'severe' | 'extreme';
};
/**
 * BetterWindowModel
 *
 * A nearby date the record says is kinder to this route than the planned one.
 *
 * Null on the response far more often than not, and that is the correct answer: most dates are
 * unremarkable, and suggesting a shift for a rounding error teaches the driver to ignore the
 * suggestion.
 */
export type BetterWindowModel = {
    /**
     * Travel Date
     */
    travel_date: string;
    /**
     * Planned Score
     *
     * How unkind the PLANNED date is, 0..1, lower being better.
     */
    planned_score: number;
    /**
     * Score
     *
     * The same score for the suggested date.
     */
    score: number;
    /**
     * Note
     */
    note: string;
};
/**
 * BriefingFactsModel
 */
export type BriefingFactsModel = {
    /**
     * Origin Name
     */
    origin_name: string;
    /**
     * Destination Name
     */
    destination_name: string;
    /**
     * Departure At
     */
    departure_at: string;
    /**
     * Arrival At
     */
    arrival_at: string;
    /**
     * Total Distance Meters
     */
    total_distance_meters: number;
    /**
     * Duration Seconds
     */
    duration_seconds: number;
    /**
     * Sample Count
     */
    sample_count: number;
    /**
     * Samples With Weather
     */
    samples_with_weather: number;
    /**
     * Overall Severity
     */
    overall_severity: 'clear' | 'caution' | 'high' | 'severe' | 'extreme';
    worst_stretch?: WorstStretchModel | null;
    /**
     * Hazards
     */
    hazards: Array<HazardModel>;
};
/**
 * BriefingProfile
 *
 * Minimal personalization block (US-5). Shapes emphasis only — never the underlying facts.
 */
export type BriefingProfile = {
    /**
     * Vehicle
     */
    vehicle?: 'car' | 'trailer' | 'motorcycle';
    /**
     * Ice Sensitivity
     */
    ice_sensitivity?: 'low' | 'med' | 'high';
    /**
     * Verbosity
     */
    verbosity?: 'terse' | 'normal';
};
/**
 * BriefingRequest
 */
export type BriefingRequest = {
    origin: PlaceModel;
    destination: PlaceModel;
    /**
     * Departure At
     *
     * Departure time. If no timezone is given, UTC is assumed.
     */
    departure_at: string;
    /**
     * Waypoints
     *
     * Ordered via points (F-006) — the briefing narrates the full multi-leg trip with dwell-shifted ETAs.
     */
    waypoints?: Array<WaypointModel>;
    /**
     * Step Meters
     */
    step_meters?: number | null;
    /**
     * The prior briefing's `facts` for this trip (v2 US-11 re-brief): when set, the response includes a grounded diff and the prose leads with what changed. Ignored when `trip_id` resolves to a stored baseline, which is strictly better (it also carries the prior PLAN version, so the cause of a change is authoritative).
     */
    previous_facts?: BriefingFactsModel | null;
    /**
     * Trip Id
     *
     * A SAVED trip of the caller's (F-012/ADR-0039). When set and owned, the server diffs against that trip's stored baseline — so the diff survives an app relaunch and crosses devices — and stores the new facts as the next baseline. A trip that is missing, not yours, or malformed is treated identically: no diff, no error, no existence signal.
     */
    trip_id?: string | null;
    /**
     * Units
     */
    units?: 'imperial' | 'metric';
    profile?: BriefingProfile | null;
};
/**
 * BriefingResponse
 */
export type BriefingResponse = {
    /**
     * Text
     *
     * Grounded natural-language briefing (plain text).
     */
    text: string;
    /**
     * Deterministic grounding source for `text`.
     */
    facts: BriefingFactsModel;
    /**
     * Model
     *
     * 'template' for the M1 skeleton; an LLM id once M3 lands.
     */
    model: string;
    /**
     * Cached
     *
     * No server cache in MVP (ADR-0013).
     */
    cached?: boolean;
    /**
     * Generated At
     */
    generated_at: string;
    /**
     * Verdict
     *
     * Deterministic engine verdict (US-6); maps 1:1 from severity.
     */
    verdict?: 'clear' | 'caution' | 'consider-waiting';
    /**
     * Verdict Line
     *
     * ≤ ~12-word opening line consistent with `verdict`.
     */
    verdict_line?: string;
    /**
     * Brief
     *
     * Two-sentence depth of the progressive disclosure (verdict line + key stretch).
     */
    brief?: string;
    /**
     * Claims
     *
     * Sentence→sample references (US-13).
     */
    claims?: Array<ClaimModel>;
    /**
     * Crossings
     */
    crossings?: Array<CrossingModel>;
    departure_window?: DepartureWindowModel | null;
    /**
     * Present when the request carried `previous_facts` (US-11).
     */
    diff?: FactsDiffModel | null;
    /**
     * Forecast Horizon Hours
     *
     * Hours between generation and departure (staleness signal, US-11).
     */
    forecast_horizon_hours?: number;
    /**
     * Stale
     *
     * True when forecast_horizon_hours ≥ the server's staleness horizon (config, default 12 h) — the prose then carries a re-check line.
     */
    stale?: boolean;
};
/**
 * CampaignSummary
 */
export type CampaignSummary = {
    /**
     * Campaign
     */
    campaign: string;
    /**
     * Drafts
     */
    drafts: number;
    /**
     * Sent
     */
    sent: number;
    /**
     * Failed
     */
    failed: number;
    /**
     * Replies
     */
    replies: number;
};
/**
 * CheckoutSessionRequest
 *
 * Start web (Stripe) checkout for a plan. The SERVER decides the trial, never the client.
 */
export type CheckoutSessionRequest = {
    /**
     * Period
     *
     * Which plan to buy; annual is the default (ADR-0022).
     */
    period?: 'annual' | 'monthly';
};
/**
 * CheckoutSessionResponse
 */
export type CheckoutSessionResponse = {
    /**
     * Url
     *
     * Stripe Checkout URL — redirect the browser here.
     */
    url: string;
    /**
     * Trial Days
     *
     * Free-trial days the server granted (0 = account/device already used it).
     */
    trial_days: number;
};
/**
 * ClaimModel
 *
 * One sentence of the briefing with its optional sample-range reference (US-13
 * tap-to-inspect). Sentences without a mappable claim carry null indices.
 */
export type ClaimModel = {
    /**
     * Text
     */
    text: string;
    /**
     * Start Index
     */
    start_index?: number | null;
    /**
     * End Index
     */
    end_index?: number | null;
};
/**
 * ConfigResponse
 */
export type ConfigResponse = {
    /**
     * Platform
     */
    platform: 'ios' | 'web';
    update: UpdateModel;
    /**
     * Features
     *
     * Feature kill switches for THIS platform. Absent flags read as enabled.
     */
    features?: {
        [key: string]: boolean;
    };
};
/**
 * ConsentInput
 *
 * A consent the client is granting/withdrawing. The server stamps ``document_version``.
 */
export type ConsentInput = {
    /**
     * Consent Type
     */
    consent_type: 'tos' | 'privacy' | 'marketing' | 'drive_recording' | 'live_location_sharing';
    /**
     * Granted
     */
    granted: boolean;
};
/**
 * ConsentModel
 *
 * A recorded consent (latest per type), returned for display/audit.
 */
export type ConsentModel = {
    /**
     * Consent Type
     */
    consent_type: 'tos' | 'privacy' | 'marketing' | 'drive_recording' | 'live_location_sharing';
    /**
     * Document Version
     */
    document_version: string;
    /**
     * Granted
     */
    granted: boolean;
    /**
     * Created At
     */
    created_at: string;
};
/**
 * ConsentsRequest
 *
 * POST /v1/me/consents — record consent events (Settings toggles, TOS re-accept).
 */
export type ConsentsRequest = {
    /**
     * Consents
     */
    consents: Array<ConsentInput>;
};
/**
 * Contact
 *
 * One person, across every campaign — the answer to "have we written to them, and what
 * happened". Assembled from campaign_sends, outreach_replies and email_suppressions together,
 * because any one of those alone gives a misleading picture.
 */
export type Contact = {
    /**
     * Email
     */
    email: string;
    /**
     * Campaigns
     */
    campaigns?: Array<string>;
    /**
     * Sends
     */
    sends?: number;
    /**
     * Failed
     */
    failed?: number;
    /**
     * Last Sent At
     */
    last_sent_at?: string | null;
    /**
     * Replied
     */
    replied?: boolean;
    /**
     * Suppressed
     */
    suppressed?: boolean;
    /**
     * Suppression Reason
     */
    suppression_reason?: string | null;
};
/**
 * CoordinateModel
 */
export type CoordinateModel = {
    /**
     * Latitude
     */
    latitude: number;
    /**
     * Longitude
     */
    longitude: number;
};
/**
 * CrossingModel
 *
 * A state change the raw numbers hide (US-10), bracketed by two sample indices.
 */
export type CrossingModel = {
    /**
     * Kind
     */
    kind: 'sunset' | 'sunrise' | 'freezing_onset' | 'freezing_clear' | 'rain_to_snow' | 'snow_to_rain';
    /**
     * From Index
     */
    from_index: number;
    /**
     * To Index
     */
    to_index: number;
    /**
     * From Eta
     */
    from_eta: string;
    /**
     * To Eta
     */
    to_eta: string;
    /**
     * From Distance Meters
     */
    from_distance_meters: number;
    /**
     * To Distance Meters
     */
    to_distance_meters: number;
};
/**
 * DeleteResponse
 *
 * GDPR/CCPA delete — MVP marks the account for deletion; a background job erases it.
 */
export type DeleteResponse = {
    /**
     * Status
     */
    status: string;
    /**
     * User Id
     */
    user_id: string;
    /**
     * Requested At
     */
    requested_at: string;
    /**
     * Detail
     */
    detail: string;
};
/**
 * DepartureOptionModel
 */
export type DepartureOptionModel = {
    /**
     * Shift Minutes
     */
    shift_minutes: number;
    /**
     * Exposure Score
     *
     * Σ weight(severity): clear 0 / caution 1 / high 2 / severe 3 / extreme 10. Extreme is weighted far above the linear step on purpose — one hour of 'do not drive into this' should move a departure that a whole afternoon of severe would not.
     */
    exposure_score: number;
    /**
     * Worst Severity
     */
    worst_severity: 'clear' | 'caution' | 'high' | 'severe' | 'extreme';
};
/**
 * DepartureWindowModel
 *
 * Engine evaluation of ±3 h departure shifts (US-8). `suggestion` exists ONLY when material —
 * a briefing may narrate a timing option strictly from this object.
 */
export type DepartureWindowModel = {
    /**
     * Material
     */
    material: boolean;
    base: DepartureOptionModel;
    suggestion?: DepartureOptionModel | null;
    /**
     * Improvement
     *
     * Base − suggestion score (0 when immaterial).
     */
    improvement?: number;
    /**
     * Options
     */
    options?: Array<DepartureOptionModel>;
};
/**
 * DraftIn
 */
export type DraftIn = {
    /**
     * Email
     */
    email: string;
    /**
     * Subject
     */
    subject: string;
    /**
     * Body Html
     */
    body_html: string;
    /**
     * Body Text
     */
    body_text?: string | null;
    /**
     * Reason
     */
    reason?: string | null;
    /**
     * Source File
     */
    source_file?: string | null;
};
/**
 * DraftOut
 */
export type DraftOut = {
    /**
     * Email
     */
    email: string;
    /**
     * Subject
     */
    subject: string;
    /**
     * Body Html
     */
    body_html: string;
    /**
     * Body Text
     */
    body_text: string;
    /**
     * Reason
     */
    reason?: string | null;
    /**
     * Source File
     */
    source_file?: string | null;
    /**
     * Updated At
     */
    updated_at?: string | null;
};
/**
 * DriveModel
 *
 * A recorded drive with its server-computed stats and simplified polyline.
 */
export type DriveModel = {
    /**
     * Id
     */
    id: string;
    /**
     * Started At
     */
    started_at: string;
    /**
     * Ended At
     */
    ended_at: string;
    /**
     * Distance Meters
     */
    distance_meters: number;
    /**
     * Duration Seconds
     */
    duration_seconds: number;
    /**
     * Moving Seconds
     */
    moving_seconds: number;
    /**
     * Avg Speed Mps
     */
    avg_speed_mps: number;
    /**
     * Max Speed Mps
     */
    max_speed_mps: number;
    /**
     * Polyline
     *
     * Simplified track as [latitude, longitude] pairs.
     */
    polyline: Array<Array<number>>;
    /**
     * Regions
     *
     * Coarse region codes crossed.
     */
    regions?: Array<string>;
    /**
     * Start Place
     */
    start_place?: string | null;
    /**
     * End Place
     */
    end_place?: string | null;
    /**
     * Visibility
     */
    visibility?: 'private';
    /**
     * Title
     */
    title?: string | null;
    /**
     * Vehicle Id
     */
    vehicle_id?: string | null;
    /**
     * Trip Id
     */
    trip_id?: string | null;
    /**
     * Created At
     */
    created_at: string;
};
/**
 * DrivePointModel
 *
 * One raw GPS fix as recorded on device.
 */
export type DrivePointModel = {
    /**
     * Latitude
     */
    latitude: number;
    /**
     * Longitude
     */
    longitude: number;
    /**
     * Timestamp
     */
    timestamp: string;
};
/**
 * DrivesResponse
 */
export type DrivesResponse = {
    /**
     * Drives
     */
    drives: Array<DriveModel>;
};
/**
 * EmailPreferencesResponse
 *
 * GET /v1/email/preferences and the two POSTs all answer with this.
 */
export type EmailPreferencesResponse = {
    /**
     * Email Masked
     *
     * The recipient address, masked (`b•••@example.com`) — never in full.
     */
    email_masked: string;
    /**
     * List Key
     *
     * Which list the link is for. `marketing` today.
     */
    list_key: string;
    /**
     * Subscribed
     *
     * False once suppressed — no further marketing goes to this address.
     */
    subscribed: boolean;
};
/**
 * ExploreFeedbackRequest
 *
 * US: 'I wanted something else' — stored (sanitized, no coordinates), never answered.
 */
export type ExploreFeedbackRequest = {
    /**
     * Intent
     */
    intent: 'passenger_stops' | 'food_mealtime' | 'fuel_charge' | 'scenic' | 'add_stop_search';
    /**
     * Note
     */
    note?: string | null;
};
/**
 * ExploreParams
 *
 * Typed intent parameters (all optional; intent-specific).
 */
export type ExploreParams = {
    /**
     * Query
     *
     * add_stop_search only: the place text to search for.
     */
    query?: string | null;
    /**
     * Fuel Type
     *
     * fuel_charge only: restrict to gas or EV charging.
     */
    fuel_type?: 'any' | 'gas' | 'ev';
    /**
     * Category
     *
     * Optional single-category filter (refinement chip).
     */
    category?: 'park' | 'playground' | 'rest_area' | 'restaurant' | 'fast_food' | 'gas_station' | 'charging_station' | 'tourist_attraction' | 'viewpoint' | null;
};
/**
 * ExploreRequest
 */
export type ExploreRequest = {
    origin: PlaceModel;
    destination: PlaceModel;
    /**
     * Departure At
     */
    departure_at: string;
    /**
     * Waypoints
     */
    waypoints?: Array<WaypointModel>;
    /**
     * Step Meters
     */
    step_meters?: number | null;
    /**
     * Intent
     */
    intent: 'passenger_stops' | 'food_mealtime' | 'fuel_charge' | 'scenic' | 'add_stop_search';
    params?: ExploreParams;
    /**
     * Refinements
     */
    refinements?: Array<'closer_to_halfway' | 'shorter_detour'>;
};
/**
 * ExploreResponse
 */
export type ExploreResponse = {
    /**
     * Intent
     */
    intent: 'passenger_stops' | 'food_mealtime' | 'fuel_charge' | 'scenic' | 'add_stop_search';
    /**
     * Cards
     */
    cards: Array<PlaceCardModel>;
    /**
     * Summary
     *
     * One grounded summary line (LLM or template; may be empty).
     */
    summary?: string;
    /**
     * Summary Model
     */
    summary_model?: string;
    /**
     * Attribution
     *
     * Display attribution for POI data.
     */
    attribution?: string;
    /**
     * Refinements Applied
     */
    refinements_applied?: Array<'closer_to_halfway' | 'shorter_detour'>;
    /**
     * Probe Count
     *
     * Corridor probe points queried (budget).
     */
    probe_count?: number;
    /**
     * Cache Hit
     *
     * True when served from the per-trip POI budget cache.
     */
    cache_hit?: boolean;
};
/**
 * ExportResponse
 *
 * GDPR/CCPA data export (F-004) — a complete, machine-readable snapshot of the account's PII,
 * produced synchronously and returned to the authenticated account holder (Art. 15/20).
 */
export type ExportResponse = {
    /**
     * User Id
     */
    user_id: string;
    /**
     * Generated At
     */
    generated_at: string;
    /**
     * Data
     *
     * All personal data the service holds for this user (profile, saved trips incl. coordinates, recorded drives incl. polylines, garage vehicles, driving stats, survey answers, consents, usage, billing linkage).
     */
    data: {
        [key: string]: unknown;
    };
};
/**
 * FactsDiffEntryModel
 */
export type FactsDiffEntryModel = {
    /**
     * Hazard
     */
    hazard: 'rain' | 'snow' | 'ice' | 'fog' | 'wind' | 'heat' | 'cold';
    /**
     * Kind
     */
    kind: 'appeared' | 'gone' | 'earlier' | 'later' | 'intensified' | 'eased';
    /**
     * Delta Minutes
     */
    delta_minutes?: number | null;
    /**
     * From Severity
     */
    from_severity?: 'clear' | 'caution' | 'high' | 'severe' | 'extreme' | null;
    /**
     * To Severity
     */
    to_severity?: 'clear' | 'caution' | 'high' | 'severe' | 'extreme' | null;
    /**
     * Residual Minutes
     *
     * F-012: movement left once the driver's own departure edit is discounted. Set only on a plan-version diff; null on a forecast-only re-brief.
     */
    residual_minutes?: number | null;
};
/**
 * FactsDiffModel
 *
 * What changed vs the previous briefing (US-11) — grounding for the 'Update:' line.
 */
export type FactsDiffModel = {
    /**
     * Entries
     */
    entries: Array<FactsDiffEntryModel>;
    /**
     * Material
     */
    material: boolean;
    /**
     * Overall From
     */
    overall_from: 'clear' | 'caution' | 'high' | 'severe' | 'extreme';
    /**
     * Overall To
     */
    overall_to: 'clear' | 'caution' | 'high' | 'severe' | 'extreme';
    /**
     * Cause
     *
     * F-012/ADR-0040: WHY the two fact sets differ — `forecast` (the sky moved), `plan_edit` (the baseline was a DIFFERENT plan version — narrate the delta relative to that plan, never as a forecast change), or `unattributed`. Server-computed; the model never picks it. Without this a plan edit and a forecast slip produce identical prose.
     */
    cause?: 'forecast' | 'plan_edit' | 'unattributed';
    /**
     * Omitted Entries
     *
     * F-012: entries beyond what the prose renders. The briefing states the count, so a long diff can never read as though nothing else changed.
     */
    omitted_entries?: number;
};
/**
 * GuidanceRouteModel
 */
export type GuidanceRouteModel = {
    /**
     * Name
     *
     * The road this route is mostly on ("I-35") — how a driver tells alternatives apart.
     */
    name?: string;
    /**
     * Steps
     */
    steps: Array<GuidanceStepModel>;
    /**
     * Polyline
     *
     * [[latitude, longitude], …] for the route.
     */
    polyline: Array<Array<number>>;
    /**
     * Distance Meters
     */
    distance_meters: number;
    /**
     * Duration Seconds
     */
    duration_seconds: number;
};
/**
 * GuidanceRouteRequest
 */
export type GuidanceRouteRequest = {
    origin: PlaceModel;
    destination: PlaceModel;
    /**
     * Waypoints
     */
    waypoints?: Array<PlaceModel>;
    vehicle?: VehicleProfileModel | null;
    /**
     * Avoid Tolls
     *
     * Route around toll roads. The clients have had an Avoid-tolls setting all along; before this it reached MapKit and not the server, so turning it on changed nothing once routing moved server-side.
     */
    avoid_tolls?: boolean;
    /**
     * Alternatives
     *
     * Also return alternative routes for the client to score. The weather-aware reroute needs more than one candidate to switch to a clearer one; without this it can only ever confirm the route it already has.
     */
    alternatives?: boolean;
    /**
     * Origin Bearing
     *
     * The driver's heading in degrees, when routing from a moving car. Keeps the new route from starting on the opposite carriageway, which opens it with a needless U-turn.
     */
    origin_bearing?: number | null;
    /**
     * Origin Radius Meters
     *
     * Only snap the origin to roads this close — for routing from a live GPS fix. Without it, a driver on toll lanes with tolls excluded is snapped to the frontage road beside them, and every reroute starts somewhere they are not.
     */
    origin_radius_meters?: number | null;
    /**
     * Language
     *
     * BCP-47 tag for spoken and written instructions, e.g. `fr` or `pt-BR`. The server maps it to the closest language the provider can speak and falls back to English; a client may simply send its device language.
     */
    language?: string | null;
    /**
     * Units
     *
     * Units for spoken announcements. Must match what the driver reads on screen, or the voice says 400 metres under a banner reading 0.2 mi.
     */
    units?: 'imperial' | 'metric';
};
/**
 * GuidanceRouteResponse
 *
 * The primary route, plus alternatives when asked for.
 *
 * ``routes[0]`` is always the primary. The flattened fields below mirror it so a client that does
 * not ask for alternatives — or one built before they existed — keeps working unchanged.
 * Duplication here is cheaper than a breaking change to a shipped contract.
 */
export type GuidanceRouteResponse = {
    /**
     * Avoided Tolls
     *
     * Whether the returned route actually avoids tolls. False when `avoid_tolls` was asked for but no toll-free route exists — the route is still returned, because stranding a driver over a preference is worse than routing them onto a toll and saying so.
     */
    avoided_tolls?: boolean;
    /**
     * Routes
     */
    routes?: Array<GuidanceRouteModel>;
    /**
     * Name
     *
     * Mirrors routes[0].name.
     */
    name?: string;
    /**
     * Steps
     */
    steps: Array<GuidanceStepModel>;
    /**
     * Polyline
     *
     * [[latitude, longitude], …] for the route.
     */
    polyline: Array<Array<number>>;
    /**
     * Distance Meters
     */
    distance_meters: number;
    /**
     * Duration Seconds
     */
    duration_seconds: number;
};
/**
 * GuidanceStepModel
 */
export type GuidanceStepModel = {
    /**
     * Instruction
     *
     * Spoken/displayed text, localized by the provider.
     */
    instruction: string;
    /**
     * Kind
     *
     * What the maneuver IS: depart, straight, turn, merge, roundabout, offRamp, onRamp, fork, uTurn, arrive. Normalized server-side so each client maps one vocabulary and a non-English route still yields the right arrow.
     */
    kind: string;
    /**
     * Direction
     *
     * Which WAY it goes: none, straight, slightLeft, left, sharpLeft, slightRight, right, sharpRight. Kept separate from `kind` because Mapbox models it that way — flattening the two dropped the direction from ramps and forks entirely.
     */
    direction?: string;
    /**
     * Polyline
     *
     * [[latitude, longitude], …] for the road leading TO this step's maneuver. The maneuver is at the LAST point, so a client counts down along this line to the turn.
     */
    polyline: Array<Array<number>>;
    /**
     * Distance Meters
     */
    distance_meters: number;
    /**
     * Duration Seconds
     */
    duration_seconds: number;
    /**
     * Voice
     *
     * Provider-phrased announcements for this maneuver, farthest first. Empty means the client times its own announcements from `instruction`.
     */
    voice?: Array<VoiceInstructionModel>;
    /**
     * Secondary Text
     *
     * Sign text under the maneuver ("toward Waco").
     */
    secondary_text?: string | null;
    /**
     * Exit Number
     *
     * Which exit to take — roundabouts and rotaries only.
     */
    exit_number?: number | null;
    /**
     * Lanes
     *
     * Lane guidance, left to right. Empty unless lanes matter for this maneuver.
     */
    lanes?: Array<LaneModel>;
    /**
     * Lanes From Meters
     *
     * Start showing `lanes` this many metres out, along the road.
     */
    lanes_from_meters?: number | null;
};
/**
 * HTTPValidationError
 */
export type HttpValidationError = {
    /**
     * Detail
     */
    detail?: Array<ValidationError>;
};
/**
 * HazardModel
 */
export type HazardModel = {
    /**
     * Type
     */
    type: 'rain' | 'snow' | 'ice' | 'fog' | 'wind' | 'heat' | 'cold';
    /**
     * Severity
     */
    severity: 'clear' | 'caution' | 'high' | 'severe' | 'extreme';
    /**
     * Start Index
     */
    start_index: number;
    /**
     * End Index
     */
    end_index: number;
    /**
     * Start Eta
     */
    start_eta: string;
    /**
     * End Eta
     */
    end_eta: string;
    /**
     * Start Distance Meters
     */
    start_distance_meters: number;
    /**
     * End Distance Meters
     */
    end_distance_meters: number;
    /**
     * Peak Detail
     *
     * Grounded description of the run's worst sample.
     */
    peak_detail: string;
};
/**
 * HistoryResponse
 */
export type HistoryResponse = {
    /**
     * Campaign
     */
    campaign: string;
    /**
     * Rows
     */
    rows?: Array<HistoryRow>;
    /**
     * Replies
     */
    replies?: Array<ReplyOut>;
};
/**
 * HistoryRow
 */
export type HistoryRow = {
    /**
     * Email
     */
    email: string;
    /**
     * Subject
     */
    subject: string;
    /**
     * Status
     */
    status: string;
    /**
     * Message Id
     */
    message_id?: string | null;
    /**
     * Error
     */
    error?: string | null;
    /**
     * Operator
     */
    operator?: string | null;
    /**
     * Sent At
     */
    sent_at?: string | null;
    /**
     * Suppressed
     */
    suppressed?: boolean;
    /**
     * Replied
     */
    replied?: boolean;
};
/**
 * LaneModel
 */
export type LaneModel = {
    /**
     * Directions
     *
     * The lane's painted arrows: straight, slightLeft, left, sharpLeft, slightRight, right, sharpRight, uTurn. Empty when the provider names one outside this set — the lane still occupies its position.
     */
    directions?: Array<string>;
    /**
     * Valid
     *
     * This lane can be used for the maneuver.
     */
    valid: boolean;
    /**
     * Preferred
     *
     * Of `directions`, the one that completes the maneuver.
     */
    preferred?: string | null;
};
/**
 * LegUpgradeRunRequest
 *
 * Whether to actually write and send. Dry by default — see the endpoint description.
 */
export type LegUpgradeRunRequest = {
    /**
     * Dry Run
     *
     * Report what WOULD happen without marking any leg or sending any mail. Defaults to true on purpose.
     */
    dry_run?: boolean;
    /**
     * Limit
     *
     * Most legs to check in this run. Each one costs a route call and a forecast fetch, so this is a cost ceiling, not a page size — the rest are picked up by the next run.
     */
    limit?: number;
};
/**
 * LegUpgradeRunResponse
 */
export type LegUpgradeRunResponse = {
    /**
     * Considered
     *
     * Unchecked dated legs inside the forecast window.
     */
    considered: number;
    /**
     * Notified
     *
     * Legs where the forecast was worth telling the driver about.
     */
    notified: Array<{
        [key: string]: unknown;
    }>;
    /**
     * Quiet
     *
     * Legs checked and found unremarkable — the healthy majority.
     */
    quiet: Array<{
        [key: string]: unknown;
    }>;
    /**
     * Deferred
     *
     * Legs left UNMARKED and due to be retried next run. A number that grows across runs means a provider is failing, not that the sweep is idle.
     */
    deferred: Array<{
        [key: string]: unknown;
    }>;
    /**
     * Abandoned
     *
     * Legs that ran out of retries and were closed out with no note — most often because there is no road between their endpoints. Their drivers will never be told about them, so a non-empty list here is worth reading.
     */
    abandoned?: Array<{
        [key: string]: unknown;
    }>;
    /**
     * Dry Run
     */
    dry_run: boolean;
};
/**
 * MeResponse
 *
 * Entitlement + funnel snapshot the clients poll to drive gating (GET /v1/me, ADR-0044).
 *
 * Reading this endpoint also CREATES the server trial on first sight for a signed-in
 * account — see the route docstring for why a GET writes.
 */
export type MeResponse = {
    /**
     * User Id
     */
    user_id: string;
    /**
     * Signed In
     *
     * Signed in with a real (non-anonymous) account.
     */
    signed_in: boolean;
    /**
     * Is Pro
     *
     * Full access: an active subscription OR an active trial.
     */
    is_pro: boolean;
    trial: TrialModel;
    /**
     * Trial Eligible
     *
     * Can still start a free trial (no prior grant on this account or device).
     */
    trial_eligible: boolean;
    /**
     * Onboarded
     *
     * Whether onboarding is complete (F-003); false => show the form.
     */
    onboarded?: boolean;
    /**
     * Active subscription's manage-routing info (ADR-0028); null when none active.
     */
    subscription?: SubscriptionModel | null;
};
/**
 * MeStatsResponse
 *
 * Per-user driving aggregates (rollup — never recomputed from polylines on read).
 */
export type MeStatsResponse = {
    /**
     * Total Distance Meters
     */
    total_distance_meters: number;
    /**
     * Drive Count
     */
    drive_count: number;
    /**
     * Total Duration Seconds
     */
    total_duration_seconds: number;
    /**
     * Regions
     *
     * Distinct coarse region codes ever driven, sorted.
     */
    regions?: Array<string>;
};
/**
 * MintLinksRequest
 *
 * POST /v1/email/links — operator-only. Mint one unsubscribe URL per address.
 *
 * Takes raw addresses because the recipients that need this most have no account and no opt-in
 * row: creator and press outreach. The batch is capped so one call can't be turned into a bulk
 * token generator.
 */
export type MintLinksRequest = {
    /**
     * Emails
     */
    emails: Array<string>;
    /**
     * List Key
     */
    list_key?: string;
};
/**
 * MintLinksResponse
 */
export type MintLinksResponse = {
    /**
     * Links
     *
     * Addresses that may be mailed, with links.
     */
    links: Array<MintedLink>;
    /**
     * Suppressed
     *
     * Addresses DROPPED because they opted out. Named, not counted: the caller has to know who to remove from the send, and a silent drop reads as 'everyone got a link'.
     */
    suppressed: Array<string>;
};
/**
 * MintedLink
 */
export type MintedLink = {
    /**
     * Email
     */
    email: string;
    /**
     * Unsubscribe Url
     *
     * Specific to this recipient — never reuse one for another person.
     */
    unsubscribe_url: string;
};
/**
 * OnboardingRequest
 *
 * POST /v1/me/onboarding — one call. Only consent is required; everything else is optional
 * (the skip path sends just the required consents). Sets ``onboarded_at``.
 */
export type OnboardingRequest = {
    /**
     * First Name
     */
    first_name?: string | null;
    /**
     * Last Name
     */
    last_name?: string | null;
    /**
     * Display Name
     */
    display_name?: string | null;
    /**
     * Phone
     */
    phone?: string | null;
    /**
     * Vehicles
     */
    vehicles?: Array<string> | null;
    /**
     * Survey
     *
     * {question_key: answer}; validated against survey options.
     */
    survey?: {
        [key: string]: unknown;
    } | null;
    /**
     * Consents
     *
     * Must include granted tos + privacy; may include marketing.
     */
    consents: Array<ConsentInput>;
};
/**
 * OutlookPointModel
 */
export type OutlookPointModel = {
    /**
     * Index
     */
    index: number;
    /**
     * Latitude
     */
    latitude: number;
    /**
     * Longitude
     */
    longitude: number;
    /**
     * Distance From Start Meters
     */
    distance_from_start_meters: number;
    /**
     * Null where we hold no history for this place. The client must say so — never fill it in from a neighbouring cell hundreds of miles away.
     */
    typical?: TypicalConditionsModel | null;
};
/**
 * OutlookRequest
 */
export type OutlookRequest = {
    origin: PlaceModel;
    destination: PlaceModel;
    /**
     * Waypoints
     */
    waypoints?: Array<WaypointModel>;
    /**
     * Travel Date
     *
     * The day this leg is driven. Required: an outlook is a statement about a time of year, so there is nothing to answer without one.
     */
    travel_date: string;
};
/**
 * OutlookResponse
 */
export type OutlookResponse = {
    /**
     * Tier
     *
     * Always 'outlook'. A constant, so a response cannot be mistaken for a forecast even by code that only reads this field.
     */
    tier?: 'outlook';
    /**
     * Travel Date
     */
    travel_date: string;
    /**
     * Distance Meters
     */
    distance_meters: number;
    /**
     * Duration Seconds
     */
    duration_seconds: number;
    /**
     * Route Coordinates
     */
    route_coordinates: Array<CoordinateModel>;
    /**
     * Points
     */
    points: Array<OutlookPointModel>;
    /**
     * Baseline
     *
     * Climate baseline period, e.g. "1991-2020". Null when no data.
     */
    baseline?: string | null;
    /**
     * Source
     *
     * e.g. "ERA5".
     */
    source?: string | null;
    /**
     * Disclaimer
     *
     * Plain-language sentence the client must show wherever these values appear. Supplied by the server so no client can ship an outlook surface without one.
     */
    disclaimer: string;
    /**
     * Coverage
     *
     * How much of the route we hold history for. 'none' means the screen should say we have nothing for this route rather than render an empty timeline.
     */
    coverage: 'full' | 'partial' | 'none';
    /**
     * Risks
     *
     * What the record flags about this route on this date, worst first. Empty is the common answer and means nothing stood out — NOT that the route is safe.
     */
    risks?: Array<SeasonalRiskModel>;
    /**
     * A nearby date the record likes better, when the difference is worth acting on. Null otherwise, which is most of the time.
     */
    better_window?: BetterWindowModel | null;
};
/**
 * OverviewResponse
 */
export type OverviewResponse = {
    totals: OverviewTotals;
    /**
     * Campaigns
     */
    campaigns?: Array<CampaignSummary>;
    /**
     * Contacts
     */
    contacts?: Array<Contact>;
};
/**
 * OverviewTotals
 */
export type OverviewTotals = {
    /**
     * Campaigns
     */
    campaigns?: number;
    /**
     * Drafts
     */
    drafts?: number;
    /**
     * People Reached
     */
    people_reached?: number;
    /**
     * Sends
     */
    sends?: number;
    /**
     * Failed
     */
    failed?: number;
    /**
     * Replies
     */
    replies?: number;
    /**
     * Suppressed
     */
    suppressed?: number;
    /**
     * Reply Rate
     */
    reply_rate?: number;
};
/**
 * PaywallResponse
 *
 * Body of a 402 — the store 7-day-trial paywall the clients render (annual-default + trial).
 */
export type PaywallResponse = {
    /**
     * Reason
     *
     * subscription_required
     */
    reason: string;
    /**
     * Message
     *
     * Human-readable, safe to show; no request echo.
     */
    message: string;
    /**
     * Plans
     *
     * Purchasable plans, annual-default first.
     */
    plans: Array<PlanOption>;
    /**
     * Trial Days
     *
     * Store free-trial length for the default plan.
     */
    trial_days: number;
};
/**
 * PlaceCardModel
 *
 * One ranked result: place · signals · route-clock placement · weather-at-pass-time.
 *
 * Signals only — the service NEVER asserts a place is 'safe'/'kid-friendly' (evaluated
 * guardrail); clients render category/hours/brand/detour and let the driver judge.
 */
export type PlaceCardModel = {
    /**
     * Name
     */
    name: string;
    /**
     * Latitude
     */
    latitude: number;
    /**
     * Longitude
     */
    longitude: number;
    /**
     * Categories
     */
    categories?: Array<string>;
    /**
     * Brand
     */
    brand?: string | null;
    /**
     * Open At Pass Time
     *
     * None = hours unknown to the provider.
     */
    open_at_pass_time?: boolean | null;
    /**
     * Detour Meters
     */
    detour_meters: number;
    /**
     * Along Route Meters
     */
    along_route_meters: number;
    /**
     * Pass Eta
     *
     * Dwell-aware ETA of the nearest route sample.
     */
    pass_eta: string;
    /**
     * Nearest Sample Index
     */
    nearest_sample_index: number;
    /**
     * The trip's own forecast at the pass-time sample.
     */
    weather?: WeatherSnapshotModel | null;
    /**
     * Score
     *
     * Deterministic engine rank score (lower = better).
     */
    score: number;
    /**
     * Source
     *
     * POI data attribution (e.g. 'mapbox').
     */
    source: string;
};
/**
 * PlaceModel
 */
export type PlaceModel = {
    /**
     * Name
     */
    name: string;
    /**
     * Latitude
     */
    latitude: number;
    /**
     * Longitude
     */
    longitude: number;
};
/**
 * PlaceRef
 */
export type PlaceRef = {
    /**
     * Name
     */
    name: string;
    /**
     * Latitude
     */
    latitude: number;
    /**
     * Longitude
     */
    longitude: number;
};
/**
 * PlanMeta
 */
export type PlanMeta = {
    /**
     * Sample Count
     */
    sample_count: number;
    /**
     * Segment Count
     */
    segment_count: number;
    /**
     * Route Point Count
     */
    route_point_count: number;
    /**
     * Provider Mode
     *
     * 'mock' until the real providers are wired.
     */
    provider_mode: string;
};
/**
 * PlanOption
 *
 * One purchasable plan shown on the paywall.
 */
export type PlanOption = {
    /**
     * Product Id
     */
    product_id: string;
    /**
     * Period
     */
    period: 'monthly' | 'annual';
    /**
     * Price
     *
     * Display price, localized by the store at purchase time.
     */
    price: string;
    /**
     * Price Amount
     *
     * Numeric price in `currency` (display only).
     */
    price_amount: number;
    /**
     * Currency
     */
    currency?: string;
    /**
     * Trial Days
     *
     * Store-offered free-trial length. Always 0 since ADR-0044: the trial is granted by our server before anyone reaches a store, so by the time this plan is shown it is spent.
     */
    trial_days?: number;
    /**
     * Is Default
     *
     * The hero plan (annual-default per ADR-0022).
     */
    is_default?: boolean;
};
/**
 * PlanTripRequest
 */
export type PlanTripRequest = {
    origin: PlaceModel;
    destination: PlaceModel;
    /**
     * Departure At
     *
     * Departure time. If no timezone is given, UTC is assumed.
     */
    departure_at: string;
    /**
     * Waypoints
     *
     * Ordered via points (F-006, up to 3), routed as one waypoint sequence.
     */
    waypoints?: Array<WaypointModel>;
    /**
     * Step Meters
     *
     * Optional route-sampling step override (meters). Omit for the adaptive spacing (15 mi on short routes, easing to 40 mi on long ones).
     */
    step_meters?: number | null;
};
/**
 * PlanTripResponse
 */
export type PlanTripResponse = {
    origin: PlaceModel;
    destination: PlaceModel;
    /**
     * Departure At
     */
    departure_at: string;
    /**
     * Arrival At
     *
     * Includes driving time AND every stop's dwell (F-006).
     */
    arrival_at: string;
    /**
     * Distance Meters
     */
    distance_meters: number;
    /**
     * Duration Seconds
     *
     * Driving time only (excludes dwell).
     */
    duration_seconds: number;
    /**
     * Waypoints
     *
     * The trip's ordered via points, echoed back (F-006).
     */
    waypoints?: Array<WaypointModel>;
    /**
     * Total Dwell Seconds
     *
     * Sum of all waypoint dwell (arrival_at already includes it).
     */
    total_dwell_seconds?: number;
    /**
     * Worst Severity
     *
     * Worst condition across the trip.
     */
    worst_severity: 'clear' | 'caution' | 'high' | 'severe' | 'extreme';
    /**
     * Route Coordinates
     *
     * Full road polyline for the map.
     */
    route_coordinates: Array<CoordinateModel>;
    /**
     * Samples
     */
    samples: Array<RouteSampleModel>;
    /**
     * Segments
     *
     * The polyline split into colored runs by severity, for map rendering.
     */
    segments: Array<SegmentModel>;
    meta: PlanMeta;
};
/**
 * PortalSessionResponse
 *
 * A Stripe Billing Portal session (ADR-0028) — cancel / switch plan / update card. Only for
 * subscriptions with ``management == 'stripe'`` (409 otherwise).
 */
export type PortalSessionResponse = {
    /**
     * Url
     *
     * Stripe Billing Portal URL — redirect the browser here.
     */
    url: string;
};
/**
 * PreviewRequest
 *
 * Which address to send the sample to, and which variant to render.
 */
export type PreviewRequest = {
    /**
     * To
     *
     * Where to send the samples.
     */
    to: string;
    /**
     * Name
     *
     * Personalisation slot.
     */
    name?: string | null;
    /**
     * Tows
     *
     * Render the RV/towing variant of email 4 instead of the general one.
     */
    tows?: boolean;
    /**
     * Trips Planned
     *
     * Usage line on the conversion email.
     */
    trips_planned?: number | null;
};
/**
 * PreviewRow
 */
export type PreviewRow = {
    /**
     * Email
     */
    email: string;
    /**
     * Subject
     */
    subject: string;
    /**
     * State
     */
    state: string;
    /**
     * Detail
     */
    detail?: string | null;
    /**
     * Reason
     */
    reason?: string | null;
    /**
     * Text Source
     */
    text_source?: string;
    /**
     * Html Bytes
     */
    html_bytes: number;
    /**
     * Text Bytes
     */
    text_bytes: number;
    /**
     * Clipped
     */
    clipped?: boolean;
    /**
     * Text Head
     */
    text_head?: string;
};
/**
 * ProfileResponse
 *
 * GET /v1/me/profile — everything the onboarding form + Settings need.
 */
export type ProfileResponse = {
    /**
     * First Name
     */
    first_name?: string | null;
    /**
     * Last Name
     */
    last_name?: string | null;
    /**
     * Display Name
     */
    display_name?: string | null;
    /**
     * Phone
     */
    phone?: string | null;
    /**
     * Onboarded
     *
     * Whether onboarding is complete (onboarded_at set).
     */
    onboarded: boolean;
    /**
     * Onboarded At
     */
    onboarded_at?: string | null;
    /**
     * Marketing Opt In
     */
    marketing_opt_in: boolean;
    /**
     * Vehicles
     *
     * Selected vehicle type codes.
     */
    vehicles: Array<string>;
    /**
     * Available Vehicle Types
     *
     * Reference list to render the multi-select.
     */
    available_vehicle_types: Array<VehicleTypeModel>;
    /**
     * Survey Answers
     */
    survey_answers?: {
        [key: string]: unknown;
    };
    /**
     * Consents
     */
    consents?: Array<ConsentModel>;
};
/**
 * ProfileUpdate
 *
 * PUT /v1/me/profile — used by onboarding's profile step and by Settings.
 */
export type ProfileUpdate = {
    /**
     * First Name
     */
    first_name?: string | null;
    /**
     * Last Name
     */
    last_name?: string | null;
    /**
     * Display Name
     */
    display_name?: string | null;
    /**
     * Phone
     */
    phone?: string | null;
    /**
     * Vehicles
     *
     * Vehicle type codes; replaces the current selection when present.
     */
    vehicles?: Array<string> | null;
    /**
     * Marketing Opt In
     *
     * Recorded as a marketing consent event + mirrored to the profile.
     */
    marketing_opt_in?: boolean | null;
};
/**
 * ReplaceTripLegsRequest
 *
 * The whole leg list, replacing what is stored.
 *
 * Replace rather than patch because reordering and re-dating are the common edits, and both are
 * whole-list operations — sending them as a sequence of per-leg patches invites a half-applied
 * itinerary if one call fails.
 */
export type ReplaceTripLegsRequest = {
    /**
     * Legs
     */
    legs?: Array<TripLegModel>;
};
/**
 * ReplyIn
 */
export type ReplyIn = {
    /**
     * Email
     */
    email: string;
    /**
     * Campaign
     */
    campaign?: string | null;
    /**
     * Kind
     */
    kind?: string;
    /**
     * Note
     */
    note?: string | null;
};
/**
 * ReplyOut
 */
export type ReplyOut = {
    /**
     * Email
     */
    email: string;
    /**
     * Campaign
     */
    campaign?: string | null;
    /**
     * Kind
     */
    kind: string;
    /**
     * Note
     */
    note?: string | null;
    /**
     * Occurred At
     */
    occurred_at?: string | null;
    /**
     * Recorded By
     */
    recorded_by?: string | null;
    /**
     * Suppressed
     */
    suppressed?: boolean;
};
/**
 * RevenueCatWebhookBody
 *
 * RevenueCat webhook envelope. ``event`` is kept loose (a raw object) so RevenueCat can add
 * fields without breaking us; the body is NEVER trusted for authorization (that's the shared
 * secret in the Authorization header).
 */
export type RevenueCatWebhookBody = {
    /**
     * Api Version
     */
    api_version?: string | null;
    /**
     * Event
     *
     * The RevenueCat event object (type, app_user_id, …).
     */
    event: {
        [key: string]: unknown;
    };
};
/**
 * RouteSampleModel
 */
export type RouteSampleModel = {
    /**
     * Index
     */
    index: number;
    /**
     * Latitude
     */
    latitude: number;
    /**
     * Longitude
     */
    longitude: number;
    /**
     * Distance From Start Meters
     */
    distance_from_start_meters: number;
    /**
     * Eta
     */
    eta: string;
    /**
     * Null when there is no forecast for this sample — either the fetch failed, or the trip is further out than anyone forecasts. `beyond_forecast` says which.
     */
    weather?: WeatherSnapshotModel | null;
    /**
     * Beyond Forecast
     *
     * True when the forecast does not reach this sample's ETA. The client must say so rather than render anything weather-shaped: before this existed, the nearest available hour was attached instead, so a trip three weeks out showed ten-day-old weather as that day's forecast.
     */
    beyond_forecast?: boolean;
    /**
     * Leg Index
     *
     * Which origin→stop/stop→stop/stop→destination leg this sample is on.
     */
    leg_index?: number;
    /**
     * Waypoint Index
     *
     * Set on the sample marking a stop: index into the trip's waypoints.
     */
    waypoint_index?: number | null;
    /**
     * Dwell Seconds
     *
     * Planned stop duration at this sample (stop-marked samples only).
     */
    dwell_seconds?: number;
};
/**
 * RunRequest
 *
 * Whether to actually send. Dry by default — see the endpoint docstring.
 */
export type RunRequest = {
    /**
     * Dry Run
     *
     * Report who WOULD be mailed without sending. Defaults to true on purpose.
     */
    dry_run?: boolean;
};
/**
 * RunResponse
 */
export type RunResponse = {
    /**
     * Considered
     *
     * Trials expiring in the next 24-48h, minus payers.
     */
    considered: number;
    /**
     * Sent
     *
     * Masked addresses actually mailed.
     */
    sent: Array<string>;
    /**
     * Skipped
     *
     * Masked address + why, for everyone else.
     */
    skipped: Array<{
        [key: string]: unknown;
    }>;
    /**
     * Dry Run
     */
    dry_run: boolean;
};
/**
 * SaveDriveRequest
 *
 * A finished recording. Raw fixes only — the server computes everything else.
 */
export type SaveDriveRequest = {
    /**
     * Points
     */
    points: Array<DrivePointModel>;
    /**
     * Vehicle Id
     */
    vehicle_id?: string | null;
    /**
     * Trip Id
     *
     * Links the drive to its planned trip (weather-along-route story).
     */
    trip_id?: string | null;
    /**
     * Title
     */
    title?: string | null;
    /**
     * Start Place
     */
    start_place?: string | null;
    /**
     * End Place
     */
    end_place?: string | null;
    /**
     * Visibility
     */
    visibility?: 'private';
};
/**
 * SaveTripRequest
 *
 * Minimal payload to persist a planned trip for cross-device sync (login-only; ADR-0025 has
 * no save cap).
 */
export type SaveTripRequest = {
    origin: PlaceRef;
    destination: PlaceRef;
    /**
     * Departure At
     */
    departure_at: string;
    /**
     * Distance Meters
     */
    distance_meters: number;
    /**
     * Duration Seconds
     */
    duration_seconds: number;
    /**
     * Worst Severity
     */
    worst_severity: string;
    /**
     * Waypoints
     */
    waypoints?: Array<WaypointModel>;
};
/**
 * SavedTripModel
 */
export type SavedTripModel = {
    /**
     * Id
     */
    id: string;
    /**
     * Origin Name
     */
    origin_name: string;
    /**
     * Destination Name
     */
    destination_name: string;
    /**
     * Departure At
     */
    departure_at: string;
    /**
     * Distance Meters
     */
    distance_meters?: number | null;
    /**
     * Worst Severity
     */
    worst_severity?: string | null;
    /**
     * Created At
     */
    created_at: string;
    /**
     * Origin Latitude
     */
    origin_latitude?: number | null;
    /**
     * Origin Longitude
     */
    origin_longitude?: number | null;
    /**
     * Destination Latitude
     */
    destination_latitude?: number | null;
    /**
     * Destination Longitude
     */
    destination_longitude?: number | null;
    /**
     * Waypoints
     */
    waypoints?: Array<WaypointModel>;
    /**
     * Legs
     *
     * The trip's dated travel days, in order. Carried on the LIST so a client has every itinerary the moment it syncs, rather than discovering them one trip at a time when a screen happens to open — which is what made an itinerary feel absent until you went looking for it.
     *
     * Empty for a trip with no days yet, which is every trip saved before legs existed. The whole list is one query, not one per trip.
     */
    legs?: Array<TripLegModel>;
};
/**
 * SavedTripsResponse
 *
 * The caller's saved trips, newest first (ADR-0029 My Trips). A named wrapper (not a bare
 * list) so pagination can be added later without breaking the generated SDKs.
 */
export type SavedTripsResponse = {
    /**
     * Trips
     *
     * Newest first, server-capped page.
     */
    trips: Array<SavedTripModel>;
};
/**
 * SeasonalRiskModel
 *
 * One thing the historical record says about this route at this time of year.
 *
 * Scored on the WORST point along the route, not the average: a route over one reliably snowy
 * pass is a snowy route however calm the other ninety miles are, and averaging the pass away is
 * how a planning tool stays quiet about the only part that mattered.
 */
export type SeasonalRiskModel = {
    /**
     * Kind
     */
    kind: 'snow' | 'wet' | 'wind' | 'heat' | 'cold';
    /**
     * Probability
     *
     * Share of days in this period that carry it. Zero for `cold`, which is judged on the typical low rather than a frequency — the note says so.
     */
    probability: number;
    /**
     * Note
     *
     * Plain-language and phrased as HISTORY. Show it as-is: a client that writes its own sentence from `kind` is a client that can get the tense wrong, and 'expect snow' for a climatology leg is the same lie as a severity chip would be.
     */
    note: string;
};
/**
 * SegmentModel
 *
 * A stretch of the route polyline drawn in a single color (its worst-of-interval severity).
 */
export type SegmentModel = {
    /**
     * Coordinates
     *
     * Consecutive polyline points; adjacent segments share a boundary point.
     */
    coordinates: Array<CoordinateModel>;
    /**
     * Severity
     *
     * Null for a stretch no forecast reaches. Clients must draw it as unknown — never as clear, which would tell a driver the road is fine when nobody knows yet.
     */
    severity?: 'clear' | 'caution' | 'high' | 'severe' | 'extreme' | null;
};
/**
 * SendRequest
 *
 * Shared by preview and send, so the review step cannot be given different inputs.
 */
export type SendRequest = {
    /**
     * Reason
     */
    reason?: string | null;
    /**
     * Opted In
     */
    opted_in?: boolean;
    /**
     * Email From
     */
    email_from?: string | null;
    /**
     * List Key
     */
    list_key?: string;
    /**
     * Max Messages
     */
    max_messages?: number;
    /**
     * Force
     */
    force?: boolean;
};
/**
 * SendResponse
 */
export type SendResponse = {
    /**
     * Campaign
     */
    campaign: string;
    /**
     * Sent
     */
    sent?: Array<{
        [key: string]: string | null;
    }>;
    /**
     * Suppressed
     */
    suppressed?: Array<{
        [key: string]: string | null;
    }>;
    /**
     * Already Sent
     */
    already_sent?: Array<{
        [key: string]: string | null;
    }>;
    /**
     * Failed
     */
    failed?: Array<{
        [key: string]: string | null;
    }>;
    /**
     * Not Attempted
     */
    not_attempted?: Array<string>;
};
/**
 * SubscriptionModel
 *
 * Where the active subscription is billed/managed (ADR-0028). ``management`` is the ONLY
 * routing signal for the clients' "Manage subscription" entry — clients must never infer the
 * store from local receipts or the current platform. Derived server-side from
 * ``entitlements.store``; internals (raw events, customer ids) are never exposed.
 */
export type SubscriptionModel = {
    /**
     * Management
     *
     * apple => manage via the App Store (iOS native sheet / web 'billed through Apple' modal); stripe => POST /v1/billing/portal-session; google => Play (future); none => promo/dev grant, show no manage entry.
     */
    management: 'apple' | 'stripe' | 'google' | 'none';
    /**
     * Store
     *
     * Purchase store as recorded by the webhook (APP_STORE/STRIPE/PLAY_STORE…).
     */
    store?: string | null;
    /**
     * Product Id
     */
    product_id?: string | null;
    /**
     * Period Type
     *
     * 'trial' during the free trial, 'normal' once converted.
     */
    period_type?: string | null;
    /**
     * Expires At
     *
     * When the current period ends (renews or expires).
     */
    expires_at?: string | null;
    /**
     * Will Renew
     *
     * False once the user has cancelled (access runs out at expiry).
     */
    will_renew?: boolean | null;
};
/**
 * SuppressIn
 */
export type SuppressIn = {
    /**
     * Email
     */
    email: string;
    /**
     * Reason
     */
    reason?: string;
};
/**
 * SuppressionOut
 */
export type SuppressionOut = {
    /**
     * Email
     */
    email: string;
    /**
     * Reason
     */
    reason?: string | null;
    /**
     * Source
     */
    source?: string | null;
    /**
     * Created At
     */
    created_at?: string | null;
};
/**
 * SurveyOptionModel
 */
export type SurveyOptionModel = {
    /**
     * Value
     */
    value: string;
    /**
     * Label
     */
    label: string;
};
/**
 * SurveyQuestionModel
 */
export type SurveyQuestionModel = {
    /**
     * Key
     */
    key: string;
    /**
     * Prompt
     */
    prompt: string;
    /**
     * Type
     */
    type: 'single' | 'multi' | 'text';
    /**
     * Options
     */
    options: Array<SurveyOptionModel>;
    /**
     * Sort
     */
    sort: number;
};
/**
 * SurveyQuestionsResponse
 */
export type SurveyQuestionsResponse = {
    /**
     * Questions
     */
    questions: Array<SurveyQuestionModel>;
};
/**
 * TrialClaimRequest
 *
 * Client-initiated one-trial-ever claim (ADR-0025), sent right before the store purchase.
 */
export type TrialClaimRequest = {
    /**
     * Device Id
     *
     * Durable per-device id.
     */
    device_id: string;
    /**
     * Platform
     */
    platform?: string;
};
/**
 * TrialClaimResponse
 */
export type TrialClaimResponse = {
    /**
     * Granted
     *
     * True if the trial was recorded for this account+device.
     */
    granted: boolean;
    /**
     * Reason
     */
    reason: string;
};
/**
 * TrialModel
 *
 * OUR server-granted trial (ADR-0044), not a store trial phase. ``active`` means the account's
 * ``trial_grants`` row is unexpired and no real subscription outranks it; ``ends_at`` is that
 * row's ``expires_at``. Apple and Stripe carry no introductory offer, so a store trial phase
 * no longer exists to report.
 */
export type TrialModel = {
    /**
     * Active
     *
     * Whether the account is in its 7-day free trial right now.
     */
    active: boolean;
    /**
     * Ends At
     *
     * When the trial auto-converts to the paid plan; null when not in trial.
     */
    ends_at?: string | null;
};
/**
 * TripLegModel
 *
 * One dated travel day of a trip.
 *
 * A trip used to be one origin → destination with a single departure. That is the right shape for
 * "what is tomorrow's drive like" and the wrong one for people who plan in weeks — so a trip is a
 * sequence of these, each with its own date and its own stops.
 */
export type TripLegModel = {
    /**
     * Ordinal
     *
     * Position in the trip, 0-based.
     */
    ordinal: number;
    origin: PlaceModel;
    destination: PlaceModel;
    /**
     * Waypoints
     */
    waypoints?: Array<WaypointModel>;
    /**
     * Travel Date
     *
     * The intended travel day. Null means UNDATED — a trip saved before legs existed, or one the user has not dated yet. Never guessed: a guessed date silently changes which weather the leg is matched against.
     */
    travel_date?: string | null;
    /**
     * Departure Time
     *
     * Optional time of day. Null means 'sometime that day', which is a real answer — inventing an hour would have the ETA maths treat a fiction as fact. Requires a date.
     */
    departure_time?: string | null;
    /**
     * Timezone
     *
     * IANA zone at the leg's origin. A long trip crosses zones, so 'the 3rd' is a different instant in Flagstaff than in Nashville.
     */
    timezone?: string | null;
    /**
     * Id
     *
     * Server-assigned. Send it BACK on a write: it is how the server carries this leg's upgrade state across the wholesale replace. A leg that arrives without one is a NEW leg and starts with no upgrade state — so dropping ids on a reorder both re-arms every notification and discards the notes already shown.
     */
    id?: string | null;
    /**
     * Upgrade Checked At
     *
     * When this leg's crossing into the forecast window was checked. Read-only. Set even when nothing was worth saying, which is the common case — so this being non-null does NOT mean the driver was warned about anything.
     */
    upgrade_checked_at?: string | null;
    /**
     * Upgrade Summary
     *
     * One line about what the real forecast turned out to be, on the legs where it was worth telling the driver. Null on a leg that has not been checked AND on one that was checked and found unremarkable — show it if it is there, show nothing if not. It describes a FORECAST: this field is only ever written once the leg is inside the forecast window.
     */
    upgrade_summary?: string | null;
};
/**
 * TripLegsResponse
 */
export type TripLegsResponse = {
    /**
     * Legs
     */
    legs: Array<TripLegModel>;
    /**
     * Summary
     *
     * One honest paragraph across the whole itinerary: how much of it is forecast and how much is history, which days were flagged, and where the plan has the least room. Null when every leg is undated, because there is nothing to say yet.
     *
     * It deliberately does NOT characterise the outlook days — that needs each leg's route and its climate normals, and inferring it from the endpoints would source a confident-looking claim from a straight line nobody is going to drive. It points at those days instead; `POST /v1/trips/outlook` answers them properly.
     */
    summary?: string | null;
    /**
     * Warnings
     *
     * Advisory only. Dates that run backwards are warned about, never rejected: a driver mid-edit has a half-ordered itinerary, and refusing the save would lose their work.
     */
    warnings?: Array<string>;
};
/**
 * TypicalConditionsModel
 *
 * What a place is usually like in the 5-day period around a date.
 *
 * Probabilities are shares of days — "roughly one day in three is wet" is something a driver can
 * plan around, where a mean precipitation depth is not.
 */
export type TypicalConditionsModel = {
    /**
     * Temp High C
     */
    temp_high_c: number;
    /**
     * Temp Low C
     */
    temp_low_c: number;
    /**
     * Wet Day Prob
     */
    wet_day_prob: number;
    /**
     * Snow Day Prob
     */
    snow_day_prob: number;
    /**
     * High Wind Prob
     *
     * Share of days with sustained wind over the towing-risk threshold.
     */
    high_wind_prob: number;
    /**
     * Extreme Heat Prob
     */
    extreme_heat_prob: number;
    /**
     * Wind Kph Mean
     */
    wind_kph_mean: number;
    /**
     * Cell Latitude
     */
    cell_latitude: number;
    /**
     * Cell Longitude
     */
    cell_longitude: number;
};
/**
 * UpdateDriveRequest
 *
 * Editable drive metadata. Stats/polyline are immutable.
 */
export type UpdateDriveRequest = {
    /**
     * Title
     */
    title?: string | null;
    /**
     * Vehicle Id
     */
    vehicle_id?: string | null;
    /**
     * Visibility
     */
    visibility?: 'private' | null;
};
/**
 * UpdateModel
 */
export type UpdateModel = {
    /**
     * Required
     *
     * True = block the app and send the user to update (below min_supported).
     */
    required?: boolean;
    /**
     * Latest Version
     */
    latest_version: string;
    /**
     * Url
     *
     * Where to update (App Store link on iOS; web reloads in place).
     */
    url?: string | null;
};
/**
 * ValidationError
 */
export type ValidationError = {
    /**
     * Location
     */
    loc: Array<string | number>;
    /**
     * Message
     */
    msg: string;
    /**
     * Error Type
     */
    type: string;
    /**
     * Input
     */
    input?: unknown;
    /**
     * Context
     */
    ctx?: {
        [key: string]: unknown;
    };
};
/**
 * VehicleCreateRequest
 */
export type VehicleCreateRequest = {
    /**
     * Make
     */
    make: string;
    /**
     * Model
     */
    model: string;
    /**
     * Year
     */
    year?: number | null;
    /**
     * Trim
     */
    trim?: string | null;
    /**
     * Color
     */
    color?: string | null;
    /**
     * Photo Path
     *
     * Supabase Storage object path (no URL).
     */
    photo_path?: string | null;
    /**
     * Vehicle Type
     *
     * A seeded vehicle_types code (car/suv/…/ev).
     */
    vehicle_type: string;
};
/**
 * VehicleModel
 */
export type VehicleModel = {
    /**
     * Id
     */
    id: string;
    /**
     * Make
     */
    make: string;
    /**
     * Model
     */
    model: string;
    /**
     * Year
     */
    year?: number | null;
    /**
     * Trim
     */
    trim?: string | null;
    /**
     * Color
     */
    color?: string | null;
    /**
     * Photo Path
     */
    photo_path?: string | null;
    /**
     * Vehicle Type
     */
    vehicle_type: string;
    /**
     * Created At
     */
    created_at: string;
};
/**
 * VehicleProfileModel
 *
 * Large-vehicle constraints for RV / towing routing.
 *
 * Mapbox avoids restrictions it knows about, and coverage varies by region — so this changes the
 * route it suggests, and is NEVER a clearance guarantee. Any UI built on it has to say so.
 */
export type VehicleProfileModel = {
    /**
     * Max Height Meters
     */
    max_height_meters?: number | null;
    /**
     * Max Width Meters
     */
    max_width_meters?: number | null;
    /**
     * Max Weight Tons
     */
    max_weight_tons?: number | null;
};
/**
 * VehicleTypeModel
 */
export type VehicleTypeModel = {
    /**
     * Code
     */
    code: string;
    /**
     * Label
     */
    label: string;
    /**
     * Sort
     */
    sort: number;
};
/**
 * VehicleUpdateRequest
 */
export type VehicleUpdateRequest = {
    /**
     * Make
     */
    make?: string | null;
    /**
     * Model
     */
    model?: string | null;
    /**
     * Year
     */
    year?: number | null;
    /**
     * Trim
     */
    trim?: string | null;
    /**
     * Color
     */
    color?: string | null;
    /**
     * Photo Path
     */
    photo_path?: string | null;
    /**
     * Vehicle Type
     */
    vehicle_type?: string | null;
};
/**
 * VehiclesResponse
 */
export type VehiclesResponse = {
    /**
     * Vehicles
     */
    vehicles: Array<VehicleModel>;
};
/**
 * VoiceInstructionModel
 */
export type VoiceInstructionModel = {
    /**
     * Distance Meters
     *
     * Speak when this many metres remain to the maneuver, measured ALONG the road — not straight-line, which fires early wherever the road bends.
     */
    distance_meters: number;
    /**
     * Text
     */
    text: string;
};
/**
 * WaypointModel
 *
 * An ordered via point with an optional planned stop (F-006).
 *
 * ``dwell_minutes`` is restricted to the product presets; every sample after the stop has its
 * ETA shifted by the cumulative dwell so the ETA-matched forecast stays true.
 */
export type WaypointModel = {
    /**
     * Name
     */
    name: string;
    /**
     * Latitude
     */
    latitude: number;
    /**
     * Longitude
     */
    longitude: number;
    /**
     * Dwell Minutes
     *
     * A pause on the same day — coffee, lunch, a photo. One of the presets 0/15/30/45/60. For staying the night somewhere, use `nights`: a 14-hour dwell is not what someone means by 'three nights in Albuquerque', and the ETA maths would carry it as one continuous drive.
     */
    dwell_minutes?: 0 | 15 | 30 | 45 | 60;
    /**
     * Nights
     *
     * How many nights the traveller stays HERE. Zero is a pass-through stop.
     *
     * This is what turns one route into an itinerary: a stop with nights ENDS a travel day, and the next day departs from it. Dallas → Albuquerque (3 nights) → Phoenix (2 nights) → Los Angeles is three travel days spread across eight, and the forecast for each one is read on its own date rather than all on the departure date.
     */
    nights?: number;
    /**
     * Departure Time
     *
     * What time the traveller sets off FROM here, on the morning after their stay. Only meaningful with `nights` — a pass-through stop is described by how long it lasts (`dwell_minutes`), an overnight one by when you leave it.
     *
     * Null means 'sometime that day', which is a real answer and the honest default: the hour someone will leave Albuquerque three days from now is a guess, and a guessed hour would have the ETA maths treat a fiction as fact.
     */
    departure_time?: string | null;
};
/**
 * WeatherSnapshotModel
 */
export type WeatherSnapshotModel = {
    /**
     * Forecast Date
     *
     * The forecast hour used for this sample.
     */
    forecast_date: string;
    /**
     * Temperature C
     */
    temperature_c: number;
    /**
     * Condition Symbol
     *
     * SF Symbol name, e.g. 'cloud.rain.fill'.
     */
    condition_symbol: string;
    /**
     * Condition Text
     */
    condition_text: string;
    /**
     * Precipitation Chance
     */
    precipitation_chance: number;
    /**
     * Precipitation Intensity Mm H
     *
     * How hard it is falling, in mm/h. Null means the provider did not say — which is NOT the same as zero, and clients must not render it as 'no rain'. Chance says how likely; only this says how hard.
     */
    precipitation_intensity_mm_h?: number | null;
    /**
     * Wind Speed Kph
     */
    wind_speed_kph: number;
    /**
     * Wind Gust Kph
     *
     * Peak gust in kph, where the provider reports one. The gust is what moves a high-sided vehicle across a lane; the sustained speed is what is left when it passes.
     */
    wind_gust_kph?: number | null;
    /**
     * Alerts
     *
     * Official warnings in force for this hour at this point. Any entry means the sample is `extreme` — this is a human judgement about something already happening, not a forecast. Watches and advisories are deliberately excluded.
     */
    alerts?: Array<'tornado' | 'severe_thunderstorm' | 'flash_flood' | 'blizzard' | 'ice_storm'>;
    /**
     * Severity
     */
    severity: 'clear' | 'caution' | 'high' | 'severe' | 'extreme';
    /**
     * Is Daytime
     *
     * Whether this sample's forecast hour is in daylight at its location (ADR-0027; backend-decided — clients must not guess day/night locally).
     */
    is_daytime?: boolean;
};
/**
 * WebhookAck
 *
 * RevenueCat webhook acknowledgement (RevenueCat only needs a 2xx; body is informational).
 */
export type WebhookAck = {
    /**
     * Received
     */
    received?: boolean;
    /**
     * Applied
     *
     * False when the event was a duplicate or stale no-op.
     */
    applied: boolean;
    /**
     * Detail
     */
    detail?: string | null;
};
/**
 * WorstStretchModel
 */
export type WorstStretchModel = {
    /**
     * Severity
     */
    severity: 'clear' | 'caution' | 'high' | 'severe' | 'extreme';
    /**
     * Dominant Hazard
     */
    dominant_hazard: 'rain' | 'snow' | 'ice' | 'fog' | 'wind' | 'heat' | 'cold';
    /**
     * Start Index
     */
    start_index: number;
    /**
     * End Index
     */
    end_index: number;
    /**
     * Start Eta
     */
    start_eta: string;
    /**
     * End Eta
     */
    end_eta: string;
    /**
     * Start Distance Meters
     */
    start_distance_meters: number;
    /**
     * End Distance Meters
     */
    end_distance_meters: number;
};
/**
 * PreviewResponse
 */
export type RoadTravelCoreApiOpsLifecyclePreviewResponse = {
    /**
     * Sent
     *
     * Keys of the messages actually handed to the sender.
     */
    sent: Array<string>;
    /**
     * Skipped
     *
     * Keys that were not sent, and why.
     */
    skipped: Array<string>;
};
/**
 * PreviewResponse
 */
export type RoadTravelCoreSchemasOpsCampaignsPreviewResponse = {
    /**
     * Campaign
     */
    campaign: string;
    /**
     * Sender
     */
    sender: string;
    /**
     * Fatal
     */
    fatal?: Array<string>;
    /**
     * Blocking
     */
    blocking?: Array<string>;
    /**
     * Rows
     */
    rows?: Array<PreviewRow>;
};
export type HealthHealthGetData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/health';
};
export type HealthHealthGetResponses = {
    /**
     * Response Health Health Get
     *
     * Successful Response
     */
    200: {
        [key: string]: unknown;
    };
};
export type HealthHealthGetResponse = HealthHealthGetResponses[keyof HealthHealthGetResponses];
export type PlanTripV1TripsPlanPostData = {
    body: PlanTripRequest;
    path?: never;
    query?: never;
    url: '/v1/trips/plan';
};
export type PlanTripV1TripsPlanPostErrors = {
    /**
     * Trial paywall (not yet entitled).
     */
    402: PaywallResponse;
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type PlanTripV1TripsPlanPostError = PlanTripV1TripsPlanPostErrors[keyof PlanTripV1TripsPlanPostErrors];
export type PlanTripV1TripsPlanPostResponses = {
    /**
     * Successful Response
     */
    200: PlanTripResponse;
};
export type PlanTripV1TripsPlanPostResponse = PlanTripV1TripsPlanPostResponses[keyof PlanTripV1TripsPlanPostResponses];
export type ListTripsV1TripsGetData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/v1/trips';
};
export type ListTripsV1TripsGetResponses = {
    /**
     * Successful Response
     */
    200: SavedTripsResponse;
};
export type ListTripsV1TripsGetResponse = ListTripsV1TripsGetResponses[keyof ListTripsV1TripsGetResponses];
export type SaveTripV1TripsPostData = {
    body: SaveTripRequest;
    path?: never;
    query?: never;
    url: '/v1/trips';
};
export type SaveTripV1TripsPostErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type SaveTripV1TripsPostError = SaveTripV1TripsPostErrors[keyof SaveTripV1TripsPostErrors];
export type SaveTripV1TripsPostResponses = {
    /**
     * Successful Response
     */
    201: SavedTripModel;
};
export type SaveTripV1TripsPostResponse = SaveTripV1TripsPostResponses[keyof SaveTripV1TripsPostResponses];
export type DeleteTripV1TripsTripIdDeleteData = {
    body?: never;
    path: {
        /**
         * Trip Id
         */
        trip_id: string;
    };
    query?: never;
    url: '/v1/trips/{trip_id}';
};
export type DeleteTripV1TripsTripIdDeleteErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type DeleteTripV1TripsTripIdDeleteError = DeleteTripV1TripsTripIdDeleteErrors[keyof DeleteTripV1TripsTripIdDeleteErrors];
export type DeleteTripV1TripsTripIdDeleteResponses = {
    /**
     * Successful Response
     */
    204: void;
};
export type DeleteTripV1TripsTripIdDeleteResponse = DeleteTripV1TripsTripIdDeleteResponses[keyof DeleteTripV1TripsTripIdDeleteResponses];
export type GetTripLegsV1TripsTripIdLegsGetData = {
    body?: never;
    path: {
        /**
         * Trip Id
         */
        trip_id: string;
    };
    query?: never;
    url: '/v1/trips/{trip_id}/legs';
};
export type GetTripLegsV1TripsTripIdLegsGetErrors = {
    /**
     * No such trip for this account.
     */
    404: unknown;
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type GetTripLegsV1TripsTripIdLegsGetError = GetTripLegsV1TripsTripIdLegsGetErrors[keyof GetTripLegsV1TripsTripIdLegsGetErrors];
export type GetTripLegsV1TripsTripIdLegsGetResponses = {
    /**
     * Successful Response
     */
    200: TripLegsResponse;
};
export type GetTripLegsV1TripsTripIdLegsGetResponse = GetTripLegsV1TripsTripIdLegsGetResponses[keyof GetTripLegsV1TripsTripIdLegsGetResponses];
export type ReplaceTripLegsV1TripsTripIdLegsPutData = {
    body: ReplaceTripLegsRequest;
    path: {
        /**
         * Trip Id
         */
        trip_id: string;
    };
    query?: never;
    url: '/v1/trips/{trip_id}/legs';
};
export type ReplaceTripLegsV1TripsTripIdLegsPutErrors = {
    /**
     * No such trip for this account.
     */
    404: unknown;
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type ReplaceTripLegsV1TripsTripIdLegsPutError = ReplaceTripLegsV1TripsTripIdLegsPutErrors[keyof ReplaceTripLegsV1TripsTripIdLegsPutErrors];
export type ReplaceTripLegsV1TripsTripIdLegsPutResponses = {
    /**
     * Successful Response
     */
    200: TripLegsResponse;
};
export type ReplaceTripLegsV1TripsTripIdLegsPutResponse = ReplaceTripLegsV1TripsTripIdLegsPutResponses[keyof ReplaceTripLegsV1TripsTripIdLegsPutResponses];
export type TripOutlookV1TripsOutlookPostData = {
    body: OutlookRequest;
    path?: never;
    query?: never;
    url: '/v1/trips/outlook';
};
export type TripOutlookV1TripsOutlookPostErrors = {
    /**
     * Trial/subscription required.
     */
    402: PaywallResponse;
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type TripOutlookV1TripsOutlookPostError = TripOutlookV1TripsOutlookPostErrors[keyof TripOutlookV1TripsOutlookPostErrors];
export type TripOutlookV1TripsOutlookPostResponses = {
    /**
     * Successful Response
     */
    200: OutlookResponse;
};
export type TripOutlookV1TripsOutlookPostResponse = TripOutlookV1TripsOutlookPostResponses[keyof TripOutlookV1TripsOutlookPostResponses];
export type ExploreV1TripsExplorePostData = {
    body: ExploreRequest;
    path?: never;
    query?: never;
    url: '/v1/trips/explore';
};
export type ExploreV1TripsExplorePostErrors = {
    /**
     * Trial paywall (not entitled).
     */
    402: PaywallResponse;
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type ExploreV1TripsExplorePostError = ExploreV1TripsExplorePostErrors[keyof ExploreV1TripsExplorePostErrors];
export type ExploreV1TripsExplorePostResponses = {
    /**
     * Successful Response
     */
    200: ExploreResponse;
};
export type ExploreV1TripsExplorePostResponse = ExploreV1TripsExplorePostResponses[keyof ExploreV1TripsExplorePostResponses];
export type AddStopPreviewV1TripsExploreAddStopPreviewPostData = {
    body: AddStopPreviewRequest;
    path?: never;
    query?: never;
    url: '/v1/trips/explore/add-stop-preview';
};
export type AddStopPreviewV1TripsExploreAddStopPreviewPostErrors = {
    /**
     * Trial paywall (not entitled).
     */
    402: PaywallResponse;
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type AddStopPreviewV1TripsExploreAddStopPreviewPostError = AddStopPreviewV1TripsExploreAddStopPreviewPostErrors[keyof AddStopPreviewV1TripsExploreAddStopPreviewPostErrors];
export type AddStopPreviewV1TripsExploreAddStopPreviewPostResponses = {
    /**
     * Successful Response
     */
    200: AddStopPreviewResponse;
};
export type AddStopPreviewV1TripsExploreAddStopPreviewPostResponse = AddStopPreviewV1TripsExploreAddStopPreviewPostResponses[keyof AddStopPreviewV1TripsExploreAddStopPreviewPostResponses];
export type ExploreFeedbackV1TripsExploreFeedbackPostData = {
    body: ExploreFeedbackRequest;
    path?: never;
    query?: never;
    url: '/v1/trips/explore/feedback';
};
export type ExploreFeedbackV1TripsExploreFeedbackPostErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type ExploreFeedbackV1TripsExploreFeedbackPostError = ExploreFeedbackV1TripsExploreFeedbackPostErrors[keyof ExploreFeedbackV1TripsExploreFeedbackPostErrors];
export type ExploreFeedbackV1TripsExploreFeedbackPostResponses = {
    /**
     * Successful Response
     */
    204: void;
};
export type ExploreFeedbackV1TripsExploreFeedbackPostResponse = ExploreFeedbackV1TripsExploreFeedbackPostResponses[keyof ExploreFeedbackV1TripsExploreFeedbackPostResponses];
export type CreateBriefingV1BriefingsPostData = {
    body: BriefingRequest;
    path?: never;
    query?: never;
    url: '/v1/briefings';
};
export type CreateBriefingV1BriefingsPostErrors = {
    /**
     * Free-tier cap reached (paywall).
     */
    402: PaywallResponse;
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type CreateBriefingV1BriefingsPostError = CreateBriefingV1BriefingsPostErrors[keyof CreateBriefingV1BriefingsPostErrors];
export type CreateBriefingV1BriefingsPostResponses = {
    /**
     * Successful Response
     */
    200: BriefingResponse;
};
export type CreateBriefingV1BriefingsPostResponse = CreateBriefingV1BriefingsPostResponses[keyof CreateBriefingV1BriefingsPostResponses];
export type GuidanceRouteV1GuidanceRoutePostData = {
    body: GuidanceRouteRequest;
    path?: never;
    query?: never;
    url: '/v1/guidance/route';
};
export type GuidanceRouteV1GuidanceRoutePostErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type GuidanceRouteV1GuidanceRoutePostError = GuidanceRouteV1GuidanceRoutePostErrors[keyof GuidanceRouteV1GuidanceRoutePostErrors];
export type GuidanceRouteV1GuidanceRoutePostResponses = {
    /**
     * Successful Response
     */
    200: GuidanceRouteResponse;
};
export type GuidanceRouteV1GuidanceRoutePostResponse = GuidanceRouteV1GuidanceRoutePostResponses[keyof GuidanceRouteV1GuidanceRoutePostResponses];
export type GetMeV1MeGetData = {
    body?: never;
    headers?: {
        /**
         * X-Device-Id
         */
        'x-device-id'?: string | null;
        /**
         * X-Platform
         */
        'x-platform'?: string | null;
        /**
         * X-Referrer
         */
        'x-referrer'?: string | null;
    };
    path?: never;
    query?: never;
    url: '/v1/me';
};
export type GetMeV1MeGetErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type GetMeV1MeGetError = GetMeV1MeGetErrors[keyof GetMeV1MeGetErrors];
export type GetMeV1MeGetResponses = {
    /**
     * Successful Response
     */
    200: MeResponse;
};
export type GetMeV1MeGetResponse = GetMeV1MeGetResponses[keyof GetMeV1MeGetResponses];
export type ClaimTrialV1MeTrialClaimPostData = {
    body: TrialClaimRequest;
    path?: never;
    query?: never;
    url: '/v1/me/trial-claim';
};
export type ClaimTrialV1MeTrialClaimPostErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type ClaimTrialV1MeTrialClaimPostError = ClaimTrialV1MeTrialClaimPostErrors[keyof ClaimTrialV1MeTrialClaimPostErrors];
export type ClaimTrialV1MeTrialClaimPostResponses = {
    /**
     * Successful Response
     */
    200: TrialClaimResponse;
};
export type ClaimTrialV1MeTrialClaimPostResponse = ClaimTrialV1MeTrialClaimPostResponses[keyof ClaimTrialV1MeTrialClaimPostResponses];
export type ExportAccountV1AccountExportPostData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/v1/account/export';
};
export type ExportAccountV1AccountExportPostResponses = {
    /**
     * Successful Response
     */
    200: ExportResponse;
};
export type ExportAccountV1AccountExportPostResponse = ExportAccountV1AccountExportPostResponses[keyof ExportAccountV1AccountExportPostResponses];
export type DeleteAccountV1AccountDeleteData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/v1/account';
};
export type DeleteAccountV1AccountDeleteResponses = {
    /**
     * Successful Response
     */
    200: DeleteResponse;
};
export type DeleteAccountV1AccountDeleteResponse = DeleteAccountV1AccountDeleteResponses[keyof DeleteAccountV1AccountDeleteResponses];
export type RevenuecatWebhookV1WebhooksRevenuecatPostData = {
    body: RevenueCatWebhookBody;
    headers?: {
        /**
         * Authorization
         *
         * RevenueCat shared-secret authorization value (required).
         */
        authorization?: string | null;
    };
    path?: never;
    query?: never;
    url: '/v1/webhooks/revenuecat';
};
export type RevenuecatWebhookV1WebhooksRevenuecatPostErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type RevenuecatWebhookV1WebhooksRevenuecatPostError = RevenuecatWebhookV1WebhooksRevenuecatPostErrors[keyof RevenuecatWebhookV1WebhooksRevenuecatPostErrors];
export type RevenuecatWebhookV1WebhooksRevenuecatPostResponses = {
    /**
     * Successful Response
     */
    200: WebhookAck;
};
export type RevenuecatWebhookV1WebhooksRevenuecatPostResponse = RevenuecatWebhookV1WebhooksRevenuecatPostResponses[keyof RevenuecatWebhookV1WebhooksRevenuecatPostResponses];
export type StripeWebhookV1WebhooksStripePostData = {
    body?: never;
    headers?: {
        /**
         * Stripe-Signature
         *
         * Stripe HMAC signature header `t=<ts>,v1=<hex>` (required).
         */
        'stripe-signature'?: string | null;
    };
    path?: never;
    query?: never;
    url: '/v1/webhooks/stripe';
};
export type StripeWebhookV1WebhooksStripePostErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type StripeWebhookV1WebhooksStripePostError = StripeWebhookV1WebhooksStripePostErrors[keyof StripeWebhookV1WebhooksStripePostErrors];
export type StripeWebhookV1WebhooksStripePostResponses = {
    /**
     * Successful Response
     */
    200: WebhookAck;
};
export type StripeWebhookV1WebhooksStripePostResponse = StripeWebhookV1WebhooksStripePostResponses[keyof StripeWebhookV1WebhooksStripePostResponses];
export type GetSurveyQuestionsV1SurveyQuestionsGetData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/v1/survey/questions';
};
export type GetSurveyQuestionsV1SurveyQuestionsGetResponses = {
    /**
     * Successful Response
     */
    200: SurveyQuestionsResponse;
};
export type GetSurveyQuestionsV1SurveyQuestionsGetResponse = GetSurveyQuestionsV1SurveyQuestionsGetResponses[keyof GetSurveyQuestionsV1SurveyQuestionsGetResponses];
export type GetProfileV1MeProfileGetData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/v1/me/profile';
};
export type GetProfileV1MeProfileGetResponses = {
    /**
     * Successful Response
     */
    200: ProfileResponse;
};
export type GetProfileV1MeProfileGetResponse = GetProfileV1MeProfileGetResponses[keyof GetProfileV1MeProfileGetResponses];
export type UpdateProfileV1MeProfilePutData = {
    body: ProfileUpdate;
    path?: never;
    query?: never;
    url: '/v1/me/profile';
};
export type UpdateProfileV1MeProfilePutErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type UpdateProfileV1MeProfilePutError = UpdateProfileV1MeProfilePutErrors[keyof UpdateProfileV1MeProfilePutErrors];
export type UpdateProfileV1MeProfilePutResponses = {
    /**
     * Successful Response
     */
    200: ProfileResponse;
};
export type UpdateProfileV1MeProfilePutResponse = UpdateProfileV1MeProfilePutResponses[keyof UpdateProfileV1MeProfilePutResponses];
export type SubmitOnboardingV1MeOnboardingPostData = {
    body: OnboardingRequest;
    path?: never;
    query?: never;
    url: '/v1/me/onboarding';
};
export type SubmitOnboardingV1MeOnboardingPostErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type SubmitOnboardingV1MeOnboardingPostError = SubmitOnboardingV1MeOnboardingPostErrors[keyof SubmitOnboardingV1MeOnboardingPostErrors];
export type SubmitOnboardingV1MeOnboardingPostResponses = {
    /**
     * Successful Response
     */
    200: ProfileResponse;
};
export type SubmitOnboardingV1MeOnboardingPostResponse = SubmitOnboardingV1MeOnboardingPostResponses[keyof SubmitOnboardingV1MeOnboardingPostResponses];
export type RecordConsentsV1MeConsentsPostData = {
    body: ConsentsRequest;
    path?: never;
    query?: never;
    url: '/v1/me/consents';
};
export type RecordConsentsV1MeConsentsPostErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type RecordConsentsV1MeConsentsPostError = RecordConsentsV1MeConsentsPostErrors[keyof RecordConsentsV1MeConsentsPostErrors];
export type RecordConsentsV1MeConsentsPostResponses = {
    /**
     * Successful Response
     */
    200: ProfileResponse;
};
export type RecordConsentsV1MeConsentsPostResponse = RecordConsentsV1MeConsentsPostResponses[keyof RecordConsentsV1MeConsentsPostResponses];
export type GetPlansV1BillingPlansGetData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/v1/billing/plans';
};
export type GetPlansV1BillingPlansGetResponses = {
    /**
     * Successful Response
     */
    200: PaywallResponse;
};
export type GetPlansV1BillingPlansGetResponse = GetPlansV1BillingPlansGetResponses[keyof GetPlansV1BillingPlansGetResponses];
export type CreateCheckoutSessionV1BillingCheckoutSessionPostData = {
    body: CheckoutSessionRequest;
    headers?: {
        /**
         * X-Platform
         */
        'x-platform'?: string | null;
    };
    path?: never;
    query?: never;
    url: '/v1/billing/checkout-session';
};
export type CreateCheckoutSessionV1BillingCheckoutSessionPostErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type CreateCheckoutSessionV1BillingCheckoutSessionPostError = CreateCheckoutSessionV1BillingCheckoutSessionPostErrors[keyof CreateCheckoutSessionV1BillingCheckoutSessionPostErrors];
export type CreateCheckoutSessionV1BillingCheckoutSessionPostResponses = {
    /**
     * Successful Response
     */
    200: CheckoutSessionResponse;
};
export type CreateCheckoutSessionV1BillingCheckoutSessionPostResponse = CreateCheckoutSessionV1BillingCheckoutSessionPostResponses[keyof CreateCheckoutSessionV1BillingCheckoutSessionPostResponses];
export type CreatePortalSessionV1BillingPortalSessionPostData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/v1/billing/portal-session';
};
export type CreatePortalSessionV1BillingPortalSessionPostResponses = {
    /**
     * Successful Response
     */
    200: PortalSessionResponse;
};
export type CreatePortalSessionV1BillingPortalSessionPostResponse = CreatePortalSessionV1BillingPortalSessionPostResponses[keyof CreatePortalSessionV1BillingPortalSessionPostResponses];
export type ListDrivesV1DrivesGetData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/v1/drives';
};
export type ListDrivesV1DrivesGetResponses = {
    /**
     * Successful Response
     */
    200: DrivesResponse;
};
export type ListDrivesV1DrivesGetResponse = ListDrivesV1DrivesGetResponses[keyof ListDrivesV1DrivesGetResponses];
export type SaveDriveV1DrivesPostData = {
    body: SaveDriveRequest;
    path?: never;
    query?: never;
    url: '/v1/drives';
};
export type SaveDriveV1DrivesPostErrors = {
    /**
     * consent_required: drive_recording not granted at current version.
     */
    400: unknown;
    /**
     * Recording is a Pro feature — subscription/trial paywall.
     */
    402: unknown;
    /**
     * drive_too_short: fewer than two usable fixes after filtering.
     */
    422: unknown;
};
export type SaveDriveV1DrivesPostResponses = {
    /**
     * Successful Response
     */
    201: DriveModel;
};
export type SaveDriveV1DrivesPostResponse = SaveDriveV1DrivesPostResponses[keyof SaveDriveV1DrivesPostResponses];
export type DeleteDriveV1DrivesDriveIdDeleteData = {
    body?: never;
    path: {
        /**
         * Drive Id
         */
        drive_id: string;
    };
    query?: never;
    url: '/v1/drives/{drive_id}';
};
export type DeleteDriveV1DrivesDriveIdDeleteErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type DeleteDriveV1DrivesDriveIdDeleteError = DeleteDriveV1DrivesDriveIdDeleteErrors[keyof DeleteDriveV1DrivesDriveIdDeleteErrors];
export type DeleteDriveV1DrivesDriveIdDeleteResponses = {
    /**
     * Successful Response
     */
    204: void;
};
export type DeleteDriveV1DrivesDriveIdDeleteResponse = DeleteDriveV1DrivesDriveIdDeleteResponses[keyof DeleteDriveV1DrivesDriveIdDeleteResponses];
export type GetDriveV1DrivesDriveIdGetData = {
    body?: never;
    path: {
        /**
         * Drive Id
         */
        drive_id: string;
    };
    query?: never;
    url: '/v1/drives/{drive_id}';
};
export type GetDriveV1DrivesDriveIdGetErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type GetDriveV1DrivesDriveIdGetError = GetDriveV1DrivesDriveIdGetErrors[keyof GetDriveV1DrivesDriveIdGetErrors];
export type GetDriveV1DrivesDriveIdGetResponses = {
    /**
     * Successful Response
     */
    200: DriveModel;
};
export type GetDriveV1DrivesDriveIdGetResponse = GetDriveV1DrivesDriveIdGetResponses[keyof GetDriveV1DrivesDriveIdGetResponses];
export type UpdateDriveV1DrivesDriveIdPatchData = {
    body: UpdateDriveRequest;
    path: {
        /**
         * Drive Id
         */
        drive_id: string;
    };
    query?: never;
    url: '/v1/drives/{drive_id}';
};
export type UpdateDriveV1DrivesDriveIdPatchErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type UpdateDriveV1DrivesDriveIdPatchError = UpdateDriveV1DrivesDriveIdPatchErrors[keyof UpdateDriveV1DrivesDriveIdPatchErrors];
export type UpdateDriveV1DrivesDriveIdPatchResponses = {
    /**
     * Successful Response
     */
    200: DriveModel;
};
export type UpdateDriveV1DrivesDriveIdPatchResponse = UpdateDriveV1DrivesDriveIdPatchResponses[keyof UpdateDriveV1DrivesDriveIdPatchResponses];
export type GetMyStatsV1MeStatsGetData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/v1/me/stats';
};
export type GetMyStatsV1MeStatsGetResponses = {
    /**
     * Successful Response
     */
    200: MeStatsResponse;
};
export type GetMyStatsV1MeStatsGetResponse = GetMyStatsV1MeStatsGetResponses[keyof GetMyStatsV1MeStatsGetResponses];
export type ListVehiclesV1VehiclesGetData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/v1/vehicles';
};
export type ListVehiclesV1VehiclesGetResponses = {
    /**
     * Successful Response
     */
    200: VehiclesResponse;
};
export type ListVehiclesV1VehiclesGetResponse = ListVehiclesV1VehiclesGetResponses[keyof ListVehiclesV1VehiclesGetResponses];
export type CreateVehicleV1VehiclesPostData = {
    body: VehicleCreateRequest;
    path?: never;
    query?: never;
    url: '/v1/vehicles';
};
export type CreateVehicleV1VehiclesPostErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type CreateVehicleV1VehiclesPostError = CreateVehicleV1VehiclesPostErrors[keyof CreateVehicleV1VehiclesPostErrors];
export type CreateVehicleV1VehiclesPostResponses = {
    /**
     * Successful Response
     */
    201: VehicleModel;
};
export type CreateVehicleV1VehiclesPostResponse = CreateVehicleV1VehiclesPostResponses[keyof CreateVehicleV1VehiclesPostResponses];
export type DeleteVehicleV1VehiclesVehicleIdDeleteData = {
    body?: never;
    path: {
        /**
         * Vehicle Id
         */
        vehicle_id: string;
    };
    query?: never;
    url: '/v1/vehicles/{vehicle_id}';
};
export type DeleteVehicleV1VehiclesVehicleIdDeleteErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type DeleteVehicleV1VehiclesVehicleIdDeleteError = DeleteVehicleV1VehiclesVehicleIdDeleteErrors[keyof DeleteVehicleV1VehiclesVehicleIdDeleteErrors];
export type DeleteVehicleV1VehiclesVehicleIdDeleteResponses = {
    /**
     * Successful Response
     */
    204: void;
};
export type DeleteVehicleV1VehiclesVehicleIdDeleteResponse = DeleteVehicleV1VehiclesVehicleIdDeleteResponses[keyof DeleteVehicleV1VehiclesVehicleIdDeleteResponses];
export type UpdateVehicleV1VehiclesVehicleIdPatchData = {
    body: VehicleUpdateRequest;
    path: {
        /**
         * Vehicle Id
         */
        vehicle_id: string;
    };
    query?: never;
    url: '/v1/vehicles/{vehicle_id}';
};
export type UpdateVehicleV1VehiclesVehicleIdPatchErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type UpdateVehicleV1VehiclesVehicleIdPatchError = UpdateVehicleV1VehiclesVehicleIdPatchErrors[keyof UpdateVehicleV1VehiclesVehicleIdPatchErrors];
export type UpdateVehicleV1VehiclesVehicleIdPatchResponses = {
    /**
     * Successful Response
     */
    200: VehicleModel;
};
export type UpdateVehicleV1VehiclesVehicleIdPatchResponse = UpdateVehicleV1VehiclesVehicleIdPatchResponses[keyof UpdateVehicleV1VehiclesVehicleIdPatchResponses];
export type GetConfigV1ConfigGetData = {
    body?: never;
    path?: never;
    query: {
        /**
         * Platform
         */
        platform: 'ios' | 'web';
        /**
         * Version
         */
        version: string;
    };
    url: '/v1/config';
};
export type GetConfigV1ConfigGetErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type GetConfigV1ConfigGetError = GetConfigV1ConfigGetErrors[keyof GetConfigV1ConfigGetErrors];
export type GetConfigV1ConfigGetResponses = {
    /**
     * Successful Response
     */
    200: ConfigResponse;
};
export type GetConfigV1ConfigGetResponse = GetConfigV1ConfigGetResponses[keyof GetConfigV1ConfigGetResponses];
export type ReadPreferencesV1EmailPreferencesGetData = {
    body?: never;
    path?: never;
    query: {
        /**
         * Token
         *
         * The signed token from the email's unsubscribe link.
         */
        token: string;
    };
    url: '/v1/email/preferences';
};
export type ReadPreferencesV1EmailPreferencesGetErrors = {
    /**
     * invalid_token — malformed, unsigned, or wrongly signed link.
     */
    400: unknown;
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type ReadPreferencesV1EmailPreferencesGetError = ReadPreferencesV1EmailPreferencesGetErrors[keyof ReadPreferencesV1EmailPreferencesGetErrors];
export type ReadPreferencesV1EmailPreferencesGetResponses = {
    /**
     * Successful Response
     */
    200: EmailPreferencesResponse;
};
export type ReadPreferencesV1EmailPreferencesGetResponse = ReadPreferencesV1EmailPreferencesGetResponses[keyof ReadPreferencesV1EmailPreferencesGetResponses];
export type UnsubscribeV1EmailUnsubscribePostData = {
    body?: never;
    path?: never;
    query: {
        /**
         * Token
         *
         * The signed token from the email's unsubscribe link.
         */
        token: string;
        /**
         * Source
         *
         * Which surface asked: the page's button, or a mailbox provider's one-click.
         */
        source?: string;
    };
    url: '/v1/email/unsubscribe';
};
export type UnsubscribeV1EmailUnsubscribePostErrors = {
    /**
     * invalid_token — malformed, unsigned, or wrongly signed link.
     */
    400: unknown;
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type UnsubscribeV1EmailUnsubscribePostError = UnsubscribeV1EmailUnsubscribePostErrors[keyof UnsubscribeV1EmailUnsubscribePostErrors];
export type UnsubscribeV1EmailUnsubscribePostResponses = {
    /**
     * Successful Response
     */
    200: EmailPreferencesResponse;
};
export type UnsubscribeV1EmailUnsubscribePostResponse = UnsubscribeV1EmailUnsubscribePostResponses[keyof UnsubscribeV1EmailUnsubscribePostResponses];
export type ResubscribeV1EmailResubscribePostData = {
    body?: never;
    path?: never;
    query: {
        /**
         * Token
         *
         * The signed token from the email's unsubscribe link.
         */
        token: string;
    };
    url: '/v1/email/resubscribe';
};
export type ResubscribeV1EmailResubscribePostErrors = {
    /**
     * invalid_token — malformed, unsigned, or wrongly signed link.
     */
    400: unknown;
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type ResubscribeV1EmailResubscribePostError = ResubscribeV1EmailResubscribePostErrors[keyof ResubscribeV1EmailResubscribePostErrors];
export type ResubscribeV1EmailResubscribePostResponses = {
    /**
     * Successful Response
     */
    200: EmailPreferencesResponse;
};
export type ResubscribeV1EmailResubscribePostResponse = ResubscribeV1EmailResubscribePostResponses[keyof ResubscribeV1EmailResubscribePostResponses];
export type MintLinksV1EmailLinksPostData = {
    body: MintLinksRequest;
    headers?: {
        /**
         * Authorization
         *
         * Operator shared secret (`Bearer <key>` or the bare value).
         */
        authorization?: string | null;
    };
    path?: never;
    query?: never;
    url: '/v1/email/links';
};
export type MintLinksV1EmailLinksPostErrors = {
    /**
     * unauthorized — missing/incorrect operator key.
     */
    401: unknown;
    /**
     * Validation Error
     */
    422: HttpValidationError;
    /**
     * email_links_unavailable — no signing key configured in this env.
     */
    503: unknown;
};
export type MintLinksV1EmailLinksPostError = MintLinksV1EmailLinksPostErrors[keyof MintLinksV1EmailLinksPostErrors];
export type MintLinksV1EmailLinksPostResponses = {
    /**
     * Successful Response
     */
    200: MintLinksResponse;
};
export type MintLinksV1EmailLinksPostResponse = MintLinksV1EmailLinksPostResponses[keyof MintLinksV1EmailLinksPostResponses];
export type PreviewSequenceV1OpsLifecyclePreviewPostData = {
    body: PreviewRequest;
    path?: never;
    query?: never;
    url: '/v1/ops/lifecycle/preview';
};
export type PreviewSequenceV1OpsLifecyclePreviewPostErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type PreviewSequenceV1OpsLifecyclePreviewPostError = PreviewSequenceV1OpsLifecyclePreviewPostErrors[keyof PreviewSequenceV1OpsLifecyclePreviewPostErrors];
export type PreviewSequenceV1OpsLifecyclePreviewPostResponses = {
    /**
     * Successful Response
     */
    200: RoadTravelCoreApiOpsLifecyclePreviewResponse;
};
export type PreviewSequenceV1OpsLifecyclePreviewPostResponse = PreviewSequenceV1OpsLifecyclePreviewPostResponses[keyof PreviewSequenceV1OpsLifecyclePreviewPostResponses];
export type RunConversionEmailsV1OpsLifecycleRunConversionPostData = {
    body: RunRequest;
    path?: never;
    query?: never;
    url: '/v1/ops/lifecycle/run-conversion';
};
export type RunConversionEmailsV1OpsLifecycleRunConversionPostErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type RunConversionEmailsV1OpsLifecycleRunConversionPostError = RunConversionEmailsV1OpsLifecycleRunConversionPostErrors[keyof RunConversionEmailsV1OpsLifecycleRunConversionPostErrors];
export type RunConversionEmailsV1OpsLifecycleRunConversionPostResponses = {
    /**
     * Successful Response
     */
    200: RunResponse;
};
export type RunConversionEmailsV1OpsLifecycleRunConversionPostResponse = RunConversionEmailsV1OpsLifecycleRunConversionPostResponses[keyof RunConversionEmailsV1OpsLifecycleRunConversionPostResponses];
export type RunLegUpgradeSweepV1OpsLifecycleRunLegUpgradesPostData = {
    body: LegUpgradeRunRequest;
    path?: never;
    query?: never;
    url: '/v1/ops/lifecycle/run-leg-upgrades';
};
export type RunLegUpgradeSweepV1OpsLifecycleRunLegUpgradesPostErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type RunLegUpgradeSweepV1OpsLifecycleRunLegUpgradesPostError = RunLegUpgradeSweepV1OpsLifecycleRunLegUpgradesPostErrors[keyof RunLegUpgradeSweepV1OpsLifecycleRunLegUpgradesPostErrors];
export type RunLegUpgradeSweepV1OpsLifecycleRunLegUpgradesPostResponses = {
    /**
     * Successful Response
     */
    200: LegUpgradeRunResponse;
};
export type RunLegUpgradeSweepV1OpsLifecycleRunLegUpgradesPostResponse = RunLegUpgradeSweepV1OpsLifecycleRunLegUpgradesPostResponses[keyof RunLegUpgradeSweepV1OpsLifecycleRunLegUpgradesPostResponses];
export type ListCampaignsV1OpsCampaignsGetData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/v1/ops/campaigns';
};
export type ListCampaignsV1OpsCampaignsGetResponses = {
    /**
     * Response List Campaigns V1 Ops Campaigns Get
     *
     * Successful Response
     */
    200: Array<CampaignSummary>;
};
export type ListCampaignsV1OpsCampaignsGetResponse = ListCampaignsV1OpsCampaignsGetResponses[keyof ListCampaignsV1OpsCampaignsGetResponses];
export type ListDraftsV1OpsCampaignsCampaignDraftsGetData = {
    body?: never;
    path: {
        /**
         * Campaign
         */
        campaign: string;
    };
    query?: never;
    url: '/v1/ops/campaigns/{campaign}/drafts';
};
export type ListDraftsV1OpsCampaignsCampaignDraftsGetErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type ListDraftsV1OpsCampaignsCampaignDraftsGetError = ListDraftsV1OpsCampaignsCampaignDraftsGetErrors[keyof ListDraftsV1OpsCampaignsCampaignDraftsGetErrors];
export type ListDraftsV1OpsCampaignsCampaignDraftsGetResponses = {
    /**
     * Response List Drafts V1 Ops Campaigns  Campaign  Drafts Get
     *
     * Successful Response
     */
    200: Array<DraftOut>;
};
export type ListDraftsV1OpsCampaignsCampaignDraftsGetResponse = ListDraftsV1OpsCampaignsCampaignDraftsGetResponses[keyof ListDraftsV1OpsCampaignsCampaignDraftsGetResponses];
export type UpsertDraftV1OpsCampaignsCampaignDraftsPutData = {
    body: DraftIn;
    path: {
        /**
         * Campaign
         */
        campaign: string;
    };
    query?: never;
    url: '/v1/ops/campaigns/{campaign}/drafts';
};
export type UpsertDraftV1OpsCampaignsCampaignDraftsPutErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type UpsertDraftV1OpsCampaignsCampaignDraftsPutError = UpsertDraftV1OpsCampaignsCampaignDraftsPutErrors[keyof UpsertDraftV1OpsCampaignsCampaignDraftsPutErrors];
export type UpsertDraftV1OpsCampaignsCampaignDraftsPutResponses = {
    /**
     * Successful Response
     */
    200: DraftOut;
};
export type UpsertDraftV1OpsCampaignsCampaignDraftsPutResponse = UpsertDraftV1OpsCampaignsCampaignDraftsPutResponses[keyof UpsertDraftV1OpsCampaignsCampaignDraftsPutResponses];
export type DeleteDraftV1OpsCampaignsCampaignDraftsEmailDeleteData = {
    body?: never;
    path: {
        /**
         * Campaign
         */
        campaign: string;
        /**
         * Email
         */
        email: string;
    };
    query?: never;
    url: '/v1/ops/campaigns/{campaign}/drafts/{email}';
};
export type DeleteDraftV1OpsCampaignsCampaignDraftsEmailDeleteErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type DeleteDraftV1OpsCampaignsCampaignDraftsEmailDeleteError = DeleteDraftV1OpsCampaignsCampaignDraftsEmailDeleteErrors[keyof DeleteDraftV1OpsCampaignsCampaignDraftsEmailDeleteErrors];
export type DeleteDraftV1OpsCampaignsCampaignDraftsEmailDeleteResponses = {
    /**
     * Response Delete Draft V1 Ops Campaigns  Campaign  Drafts  Email  Delete
     *
     * Successful Response
     */
    200: {
        [key: string]: boolean;
    };
};
export type DeleteDraftV1OpsCampaignsCampaignDraftsEmailDeleteResponse = DeleteDraftV1OpsCampaignsCampaignDraftsEmailDeleteResponses[keyof DeleteDraftV1OpsCampaignsCampaignDraftsEmailDeleteResponses];
export type GetDraftV1OpsCampaignsCampaignDraftsEmailGetData = {
    body?: never;
    path: {
        /**
         * Campaign
         */
        campaign: string;
        /**
         * Email
         */
        email: string;
    };
    query?: never;
    url: '/v1/ops/campaigns/{campaign}/drafts/{email}';
};
export type GetDraftV1OpsCampaignsCampaignDraftsEmailGetErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type GetDraftV1OpsCampaignsCampaignDraftsEmailGetError = GetDraftV1OpsCampaignsCampaignDraftsEmailGetErrors[keyof GetDraftV1OpsCampaignsCampaignDraftsEmailGetErrors];
export type GetDraftV1OpsCampaignsCampaignDraftsEmailGetResponses = {
    /**
     * Successful Response
     */
    200: DraftOut;
};
export type GetDraftV1OpsCampaignsCampaignDraftsEmailGetResponse = GetDraftV1OpsCampaignsCampaignDraftsEmailGetResponses[keyof GetDraftV1OpsCampaignsCampaignDraftsEmailGetResponses];
export type PreviewV1OpsCampaignsCampaignPreviewPostData = {
    body: SendRequest;
    path: {
        /**
         * Campaign
         */
        campaign: string;
    };
    query?: never;
    url: '/v1/ops/campaigns/{campaign}/preview';
};
export type PreviewV1OpsCampaignsCampaignPreviewPostErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type PreviewV1OpsCampaignsCampaignPreviewPostError = PreviewV1OpsCampaignsCampaignPreviewPostErrors[keyof PreviewV1OpsCampaignsCampaignPreviewPostErrors];
export type PreviewV1OpsCampaignsCampaignPreviewPostResponses = {
    /**
     * Successful Response
     */
    200: RoadTravelCoreSchemasOpsCampaignsPreviewResponse;
};
export type PreviewV1OpsCampaignsCampaignPreviewPostResponse = PreviewV1OpsCampaignsCampaignPreviewPostResponses[keyof PreviewV1OpsCampaignsCampaignPreviewPostResponses];
export type SendV1OpsCampaignsCampaignSendPostData = {
    body: SendRequest;
    path: {
        /**
         * Campaign
         */
        campaign: string;
    };
    query?: never;
    url: '/v1/ops/campaigns/{campaign}/send';
};
export type SendV1OpsCampaignsCampaignSendPostErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type SendV1OpsCampaignsCampaignSendPostError = SendV1OpsCampaignsCampaignSendPostErrors[keyof SendV1OpsCampaignsCampaignSendPostErrors];
export type SendV1OpsCampaignsCampaignSendPostResponses = {
    /**
     * Successful Response
     */
    200: SendResponse;
};
export type SendV1OpsCampaignsCampaignSendPostResponse = SendV1OpsCampaignsCampaignSendPostResponses[keyof SendV1OpsCampaignsCampaignSendPostResponses];
export type HistoryV1OpsCampaignsCampaignHistoryGetData = {
    body?: never;
    path: {
        /**
         * Campaign
         */
        campaign: string;
    };
    query?: never;
    url: '/v1/ops/campaigns/{campaign}/history';
};
export type HistoryV1OpsCampaignsCampaignHistoryGetErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type HistoryV1OpsCampaignsCampaignHistoryGetError = HistoryV1OpsCampaignsCampaignHistoryGetErrors[keyof HistoryV1OpsCampaignsCampaignHistoryGetErrors];
export type HistoryV1OpsCampaignsCampaignHistoryGetResponses = {
    /**
     * Successful Response
     */
    200: HistoryResponse;
};
export type HistoryV1OpsCampaignsCampaignHistoryGetResponse = HistoryV1OpsCampaignsCampaignHistoryGetResponses[keyof HistoryV1OpsCampaignsCampaignHistoryGetResponses];
export type RecordReplyV1OpsRepliesPostData = {
    body: ReplyIn;
    path?: never;
    query?: never;
    url: '/v1/ops/replies';
};
export type RecordReplyV1OpsRepliesPostErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type RecordReplyV1OpsRepliesPostError = RecordReplyV1OpsRepliesPostErrors[keyof RecordReplyV1OpsRepliesPostErrors];
export type RecordReplyV1OpsRepliesPostResponses = {
    /**
     * Successful Response
     */
    200: ReplyOut;
};
export type RecordReplyV1OpsRepliesPostResponse = RecordReplyV1OpsRepliesPostResponses[keyof RecordReplyV1OpsRepliesPostResponses];
export type OverviewV1OpsOverviewGetData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/v1/ops/overview';
};
export type OverviewV1OpsOverviewGetResponses = {
    /**
     * Successful Response
     */
    200: OverviewResponse;
};
export type OverviewV1OpsOverviewGetResponse = OverviewV1OpsOverviewGetResponses[keyof OverviewV1OpsOverviewGetResponses];
export type SuppressionsV1OpsSuppressionsGetData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/v1/ops/suppressions';
};
export type SuppressionsV1OpsSuppressionsGetResponses = {
    /**
     * Response Suppressions V1 Ops Suppressions Get
     *
     * Successful Response
     */
    200: Array<SuppressionOut>;
};
export type SuppressionsV1OpsSuppressionsGetResponse = SuppressionsV1OpsSuppressionsGetResponses[keyof SuppressionsV1OpsSuppressionsGetResponses];
export type SuppressV1OpsSuppressionsPostData = {
    body: SuppressIn;
    path?: never;
    query?: never;
    url: '/v1/ops/suppressions';
};
export type SuppressV1OpsSuppressionsPostErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type SuppressV1OpsSuppressionsPostError = SuppressV1OpsSuppressionsPostErrors[keyof SuppressV1OpsSuppressionsPostErrors];
export type SuppressV1OpsSuppressionsPostResponses = {
    /**
     * Successful Response
     */
    200: SuppressionOut;
};
export type SuppressV1OpsSuppressionsPostResponse = SuppressV1OpsSuppressionsPostResponses[keyof SuppressV1OpsSuppressionsPostResponses];
export type UnsuppressV1OpsSuppressionsEmailDeleteData = {
    body?: never;
    path: {
        /**
         * Email
         */
        email: string;
    };
    query?: never;
    url: '/v1/ops/suppressions/{email}';
};
export type UnsuppressV1OpsSuppressionsEmailDeleteErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};
export type UnsuppressV1OpsSuppressionsEmailDeleteError = UnsuppressV1OpsSuppressionsEmailDeleteErrors[keyof UnsuppressV1OpsSuppressionsEmailDeleteErrors];
export type UnsuppressV1OpsSuppressionsEmailDeleteResponses = {
    /**
     * Response Unsuppress V1 Ops Suppressions  Email  Delete
     *
     * Successful Response
     */
    200: {
        [key: string]: boolean;
    };
};
export type UnsuppressV1OpsSuppressionsEmailDeleteResponse = UnsuppressV1OpsSuppressionsEmailDeleteResponses[keyof UnsuppressV1OpsSuppressionsEmailDeleteResponses];
//# sourceMappingURL=types.gen.d.ts.map