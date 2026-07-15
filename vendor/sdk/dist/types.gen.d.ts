export type ClientOptions = {
    baseUrl: `${string}://${string}` | (string & {});
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
    overall_severity: 'clear' | 'caution' | 'severe';
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
     * Step Meters
     */
    step_meters?: number | null;
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
 * ConsentInput
 *
 * A consent the client is granting/withdrawing. The server stamps ``document_version``.
 */
export type ConsentInput = {
    /**
     * Consent Type
     */
    consent_type: 'tos' | 'privacy' | 'marketing';
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
    consent_type: 'tos' | 'privacy' | 'marketing';
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
 * ExportResponse
 *
 * GDPR/CCPA export — MVP marks the request; a background job fulfils it (ADR-0019 stub).
 */
export type ExportResponse = {
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
     *
     * What will happen and roughly when.
     */
    detail: string;
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
    severity: 'clear' | 'caution' | 'severe';
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
 * MeResponse
 *
 * Entitlement + funnel snapshot the clients poll to drive gating (GET /v1/me, ADR-0025).
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
     * Free-trial length; 0 = no trial.
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
     */
    arrival_at: string;
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
     *
     * Worst condition across the trip.
     */
    worst_severity: 'clear' | 'caution' | 'severe';
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
     * Null when the forecast fetch for this sample's cell failed.
     */
    weather?: WeatherSnapshotModel | null;
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
     */
    severity: 'clear' | 'caution' | 'severe';
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
 * The store's 7-day free-trial state (ADR-0025).
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
     * Wind Speed Kph
     */
    wind_speed_kph: number;
    /**
     * Severity
     */
    severity: 'clear' | 'caution' | 'severe';
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
    severity: 'clear' | 'caution' | 'severe';
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
export type GetMeV1MeGetData = {
    body?: never;
    headers?: {
        /**
         * X-Device-Id
         */
        'x-device-id'?: string | null;
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
export type CreateCheckoutSessionV1BillingCheckoutSessionPostData = {
    body: CheckoutSessionRequest;
    headers?: {
        /**
         * X-Device-Id
         */
        'x-device-id'?: string | null;
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
//# sourceMappingURL=types.gen.d.ts.map