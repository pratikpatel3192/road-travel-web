import type { Client, ClientMeta, Options as Options2, RequestResult, TDataShape } from './client';
import type { AddStopPreviewV1TripsExploreAddStopPreviewPostData, AddStopPreviewV1TripsExploreAddStopPreviewPostErrors, AddStopPreviewV1TripsExploreAddStopPreviewPostResponses, ClaimTrialV1MeTrialClaimPostData, ClaimTrialV1MeTrialClaimPostErrors, ClaimTrialV1MeTrialClaimPostResponses, CreateBriefingV1BriefingsPostData, CreateBriefingV1BriefingsPostErrors, CreateBriefingV1BriefingsPostResponses, CreateCheckoutSessionV1BillingCheckoutSessionPostData, CreateCheckoutSessionV1BillingCheckoutSessionPostErrors, CreateCheckoutSessionV1BillingCheckoutSessionPostResponses, CreatePortalSessionV1BillingPortalSessionPostData, CreatePortalSessionV1BillingPortalSessionPostResponses, DeleteAccountV1AccountDeleteData, DeleteAccountV1AccountDeleteResponses, DeleteTripV1TripsTripIdDeleteData, DeleteTripV1TripsTripIdDeleteErrors, DeleteTripV1TripsTripIdDeleteResponses, ExploreFeedbackV1TripsExploreFeedbackPostData, ExploreFeedbackV1TripsExploreFeedbackPostErrors, ExploreFeedbackV1TripsExploreFeedbackPostResponses, ExploreV1TripsExplorePostData, ExploreV1TripsExplorePostErrors, ExploreV1TripsExplorePostResponses, ExportAccountV1AccountExportPostData, ExportAccountV1AccountExportPostResponses, GetMeV1MeGetData, GetMeV1MeGetErrors, GetMeV1MeGetResponses, GetProfileV1MeProfileGetData, GetProfileV1MeProfileGetResponses, GetSurveyQuestionsV1SurveyQuestionsGetData, GetSurveyQuestionsV1SurveyQuestionsGetResponses, HealthHealthGetData, HealthHealthGetResponses, ListTripsV1TripsGetData, ListTripsV1TripsGetResponses, PlanTripV1TripsPlanPostData, PlanTripV1TripsPlanPostErrors, PlanTripV1TripsPlanPostResponses, RecordConsentsV1MeConsentsPostData, RecordConsentsV1MeConsentsPostErrors, RecordConsentsV1MeConsentsPostResponses, RevenuecatWebhookV1WebhooksRevenuecatPostData, RevenuecatWebhookV1WebhooksRevenuecatPostErrors, RevenuecatWebhookV1WebhooksRevenuecatPostResponses, SaveTripV1TripsPostData, SaveTripV1TripsPostErrors, SaveTripV1TripsPostResponses, StripeWebhookV1WebhooksStripePostData, StripeWebhookV1WebhooksStripePostErrors, StripeWebhookV1WebhooksStripePostResponses, SubmitOnboardingV1MeOnboardingPostData, SubmitOnboardingV1MeOnboardingPostErrors, SubmitOnboardingV1MeOnboardingPostResponses, UpdateProfileV1MeProfilePutData, UpdateProfileV1MeProfilePutErrors, UpdateProfileV1MeProfilePutResponses } from './types.gen';
export type Options<TData extends TDataShape = TDataShape, ThrowOnError extends boolean = boolean, TResponse = unknown> = Options2<TData, ThrowOnError, TResponse> & {
    /**
     * You can provide a client instance returned by `createClient()` instead of
     * individual options. This might be also useful if you want to implement a
     * custom client.
     */
    client?: Client;
    /**
     * You can pass arbitrary values through the `meta` object. This can be
     * used to access values that aren't defined as part of the SDK function.
     */
    meta?: keyof ClientMeta extends never ? Record<string, unknown> : ClientMeta;
};
/**
 * Service health and provider readiness
 */
export declare const healthHealthGet: <ThrowOnError extends boolean = false>(options?: Options<HealthHealthGetData, ThrowOnError>) => RequestResult<HealthHealthGetResponses, unknown, ThrowOnError>;
/**
 * Plan a trip: sampled points along the route, each with its ETA-hour forecast
 */
export declare const planTripV1TripsPlanPost: <ThrowOnError extends boolean = false>(options: Options<PlanTripV1TripsPlanPostData, ThrowOnError>) => RequestResult<PlanTripV1TripsPlanPostResponses, PlanTripV1TripsPlanPostErrors, ThrowOnError>;
/**
 * The caller's saved trips, newest first (login-only; ADR-0029 My Trips)
 */
export declare const listTripsV1TripsGet: <ThrowOnError extends boolean = false>(options?: Options<ListTripsV1TripsGetData, ThrowOnError>) => RequestResult<ListTripsV1TripsGetResponses, unknown, ThrowOnError>;
/**
 * Save a planned trip for cross-device sync (login-only; no save cap)
 */
export declare const saveTripV1TripsPost: <ThrowOnError extends boolean = false>(options: Options<SaveTripV1TripsPostData, ThrowOnError>) => RequestResult<SaveTripV1TripsPostResponses, SaveTripV1TripsPostErrors, ThrowOnError>;
/**
 * Delete one of the caller's saved trips (owner-scoped; 404 otherwise)
 */
export declare const deleteTripV1TripsTripIdDelete: <ThrowOnError extends boolean = false>(options: Options<DeleteTripV1TripsTripIdDeleteData, ThrowOnError>) => RequestResult<DeleteTripV1TripsTripIdDeleteResponses, DeleteTripV1TripsTripIdDeleteErrors, ThrowOnError>;
/**
 * One-tap corridor discovery: ranked stops along the planned trip (Pro)
 */
export declare const exploreV1TripsExplorePost: <ThrowOnError extends boolean = false>(options: Options<ExploreV1TripsExplorePostData, ThrowOnError>) => RequestResult<ExploreV1TripsExplorePostResponses, ExploreV1TripsExplorePostErrors, ThrowOnError>;
/**
 * F-006 delta preview for a candidate stop: added time + changed weather exposure
 */
export declare const addStopPreviewV1TripsExploreAddStopPreviewPost: <ThrowOnError extends boolean = false>(options: Options<AddStopPreviewV1TripsExploreAddStopPreviewPostData, ThrowOnError>) => RequestResult<AddStopPreviewV1TripsExploreAddStopPreviewPostResponses, AddStopPreviewV1TripsExploreAddStopPreviewPostErrors, ThrowOnError>;
/**
 * 'I wanted something else' — recorded (sanitized), never answered (F-005 v1)
 */
export declare const exploreFeedbackV1TripsExploreFeedbackPost: <ThrowOnError extends boolean = false>(options: Options<ExploreFeedbackV1TripsExploreFeedbackPostData, ThrowOnError>) => RequestResult<ExploreFeedbackV1TripsExploreFeedbackPostResponses, ExploreFeedbackV1TripsExploreFeedbackPostErrors, ThrowOnError>;
/**
 * Generate a grounded natural-language briefing for a planned trip
 */
export declare const createBriefingV1BriefingsPost: <ThrowOnError extends boolean = false>(options: Options<CreateBriefingV1BriefingsPostData, ThrowOnError>) => RequestResult<CreateBriefingV1BriefingsPostResponses, CreateBriefingV1BriefingsPostErrors, ThrowOnError>;
/**
 * Current user's entitlement + funnel snapshot (drives client gating/paywall)
 */
export declare const getMeV1MeGet: <ThrowOnError extends boolean = false>(options?: Options<GetMeV1MeGetData, ThrowOnError>) => RequestResult<GetMeV1MeGetResponses, GetMeV1MeGetErrors, ThrowOnError>;
/**
 * Claim the one-free-trial-ever grant (account + device) before the store purchase
 */
export declare const claimTrialV1MeTrialClaimPost: <ThrowOnError extends boolean = false>(options: Options<ClaimTrialV1MeTrialClaimPostData, ThrowOnError>) => RequestResult<ClaimTrialV1MeTrialClaimPostResponses, ClaimTrialV1MeTrialClaimPostErrors, ThrowOnError>;
/**
 * Request a GDPR/CCPA export of the account's data (MVP: queued)
 */
export declare const exportAccountV1AccountExportPost: <ThrowOnError extends boolean = false>(options?: Options<ExportAccountV1AccountExportPostData, ThrowOnError>) => RequestResult<ExportAccountV1AccountExportPostResponses, unknown, ThrowOnError>;
/**
 * Request account deletion (GDPR/CCPA): purge app data + enqueue identity removal
 */
export declare const deleteAccountV1AccountDelete: <ThrowOnError extends boolean = false>(options?: Options<DeleteAccountV1AccountDeleteData, ThrowOnError>) => RequestResult<DeleteAccountV1AccountDeleteResponses, unknown, ThrowOnError>;
/**
 * RevenueCat entitlement webhook (signature-verified, idempotent)
 *
 * Called by RevenueCat, not by app clients. **Not** JWT-authenticated: it is authorized by a shared secret that RevenueCat sends verbatim in the `Authorization` header (set in the RevenueCat dashboard) and compared in constant time. Fail-closed outside `local`, and idempotent. SEC-25: documented here so the auth mechanism is visible in the contract.
 */
export declare const revenuecatWebhookV1WebhooksRevenuecatPost: <ThrowOnError extends boolean = false>(options: Options<RevenuecatWebhookV1WebhooksRevenuecatPostData, ThrowOnError>) => RequestResult<RevenuecatWebhookV1WebhooksRevenuecatPostResponses, RevenuecatWebhookV1WebhooksRevenuecatPostErrors, ThrowOnError>;
/**
 * Stripe web-billing entitlement webhook (signature-verified, idempotent)
 *
 * Called by Stripe, not by app clients. **Not** JWT-authenticated: authorized by the `Stripe-Signature` header — an HMAC-SHA256 over `"{t}.{raw_body}"` with the webhook signing secret, compared in constant time, with a replay-window check on `t` (SEC-08). Fail-closed outside `local`, idempotent. SEC-25: documented so the auth is visible in the contract.
 */
export declare const stripeWebhookV1WebhooksStripePost: <ThrowOnError extends boolean = false>(options?: Options<StripeWebhookV1WebhooksStripePostData, ThrowOnError>) => RequestResult<StripeWebhookV1WebhooksStripePostResponses, StripeWebhookV1WebhooksStripePostErrors, ThrowOnError>;
/**
 * Active onboarding survey questions (for the client to render)
 */
export declare const getSurveyQuestionsV1SurveyQuestionsGet: <ThrowOnError extends boolean = false>(options?: Options<GetSurveyQuestionsV1SurveyQuestionsGetData, ThrowOnError>) => RequestResult<GetSurveyQuestionsV1SurveyQuestionsGetResponses, unknown, ThrowOnError>;
/**
 * Current user's profile + vehicles + survey answers + consents
 */
export declare const getProfileV1MeProfileGet: <ThrowOnError extends boolean = false>(options?: Options<GetProfileV1MeProfileGetData, ThrowOnError>) => RequestResult<GetProfileV1MeProfileGetResponses, unknown, ThrowOnError>;
/**
 * Update profile (name/display/phone/vehicles/marketing) — onboarding step + Settings
 */
export declare const updateProfileV1MeProfilePut: <ThrowOnError extends boolean = false>(options: Options<UpdateProfileV1MeProfilePutData, ThrowOnError>) => RequestResult<UpdateProfileV1MeProfilePutResponses, UpdateProfileV1MeProfilePutErrors, ThrowOnError>;
/**
 * Complete onboarding: profile + survey + consents; sets onboarded_at
 */
export declare const submitOnboardingV1MeOnboardingPost: <ThrowOnError extends boolean = false>(options: Options<SubmitOnboardingV1MeOnboardingPostData, ThrowOnError>) => RequestResult<SubmitOnboardingV1MeOnboardingPostResponses, SubmitOnboardingV1MeOnboardingPostErrors, ThrowOnError>;
/**
 * Record consent events (Settings toggles, TOS re-accept on version bump)
 */
export declare const recordConsentsV1MeConsentsPost: <ThrowOnError extends boolean = false>(options: Options<RecordConsentsV1MeConsentsPostData, ThrowOnError>) => RequestResult<RecordConsentsV1MeConsentsPostResponses, RecordConsentsV1MeConsentsPostErrors, ThrowOnError>;
/**
 * Create a Stripe Checkout Session (card up front; server decides the 7-day trial)
 */
export declare const createCheckoutSessionV1BillingCheckoutSessionPost: <ThrowOnError extends boolean = false>(options: Options<CreateCheckoutSessionV1BillingCheckoutSessionPostData, ThrowOnError>) => RequestResult<CreateCheckoutSessionV1BillingCheckoutSessionPostResponses, CreateCheckoutSessionV1BillingCheckoutSessionPostErrors, ThrowOnError>;
/**
 * Create a Stripe Billing Portal session (ADR-0028; Stripe-billed subscriptions only)
 */
export declare const createPortalSessionV1BillingPortalSessionPost: <ThrowOnError extends boolean = false>(options?: Options<CreatePortalSessionV1BillingPortalSessionPostData, ThrowOnError>) => RequestResult<CreatePortalSessionV1BillingPortalSessionPostResponses, unknown, ThrowOnError>;
//# sourceMappingURL=sdk.gen.d.ts.map