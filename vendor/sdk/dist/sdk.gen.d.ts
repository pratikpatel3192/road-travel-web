import type { Client, ClientMeta, Options as Options2, RequestResult, TDataShape } from './client';
import type { AddStopPreviewV1TripsExploreAddStopPreviewPostData, AddStopPreviewV1TripsExploreAddStopPreviewPostErrors, AddStopPreviewV1TripsExploreAddStopPreviewPostResponses, BlockUserV1SocialBlocksPostData, BlockUserV1SocialBlocksPostErrors, BlockUserV1SocialBlocksPostResponses, ClaimTrialV1MeTrialClaimPostData, ClaimTrialV1MeTrialClaimPostErrors, ClaimTrialV1MeTrialClaimPostResponses, CreateBriefingV1BriefingsPostData, CreateBriefingV1BriefingsPostErrors, CreateBriefingV1BriefingsPostResponses, CreateCheckoutSessionV1BillingCheckoutSessionPostData, CreateCheckoutSessionV1BillingCheckoutSessionPostErrors, CreateCheckoutSessionV1BillingCheckoutSessionPostResponses, CreateConversationV1ConversationsPostData, CreateConversationV1ConversationsPostErrors, CreateConversationV1ConversationsPostResponses, CreatePortalSessionV1BillingPortalSessionPostData, CreatePortalSessionV1BillingPortalSessionPostResponses, CreateVehicleV1VehiclesPostData, CreateVehicleV1VehiclesPostErrors, CreateVehicleV1VehiclesPostResponses, DeleteAccountV1AccountDeleteData, DeleteAccountV1AccountDeleteResponses, DeleteDraftV1OpsCampaignsCampaignDraftsEmailDeleteData, DeleteDraftV1OpsCampaignsCampaignDraftsEmailDeleteErrors, DeleteDraftV1OpsCampaignsCampaignDraftsEmailDeleteResponses, DeleteDriveV1DrivesDriveIdDeleteData, DeleteDriveV1DrivesDriveIdDeleteErrors, DeleteDriveV1DrivesDriveIdDeleteResponses, DeleteTripV1TripsTripIdDeleteData, DeleteTripV1TripsTripIdDeleteErrors, DeleteTripV1TripsTripIdDeleteResponses, DeleteVehicleV1VehiclesVehicleIdDeleteData, DeleteVehicleV1VehiclesVehicleIdDeleteErrors, DeleteVehicleV1VehiclesVehicleIdDeleteResponses, ExploreFeedbackV1TripsExploreFeedbackPostData, ExploreFeedbackV1TripsExploreFeedbackPostErrors, ExploreFeedbackV1TripsExploreFeedbackPostResponses, ExploreV1TripsExplorePostData, ExploreV1TripsExplorePostErrors, ExploreV1TripsExplorePostResponses, ExportAccountV1AccountExportPostData, ExportAccountV1AccountExportPostResponses, FriendDrivesV1SocialFriendsFriendshipIdDrivesGetData, FriendDrivesV1SocialFriendsFriendshipIdDrivesGetErrors, FriendDrivesV1SocialFriendsFriendshipIdDrivesGetResponses, FriendSessionsV1SocialFriendsSessionsGetData, FriendSessionsV1SocialFriendsSessionsGetResponses, GetConfigV1ConfigGetData, GetConfigV1ConfigGetErrors, GetConfigV1ConfigGetResponses, GetDraftV1OpsCampaignsCampaignDraftsEmailGetData, GetDraftV1OpsCampaignsCampaignDraftsEmailGetErrors, GetDraftV1OpsCampaignsCampaignDraftsEmailGetResponses, GetDriveV1DrivesDriveIdGetData, GetDriveV1DrivesDriveIdGetErrors, GetDriveV1DrivesDriveIdGetResponses, GetMessagesV1ConversationsConversationIdMessagesGetData, GetMessagesV1ConversationsConversationIdMessagesGetErrors, GetMessagesV1ConversationsConversationIdMessagesGetResponses, GetMeV1MeGetData, GetMeV1MeGetErrors, GetMeV1MeGetResponses, GetMyStatsV1MeStatsGetData, GetMyStatsV1MeStatsGetResponses, GetPlansV1BillingPlansGetData, GetPlansV1BillingPlansGetResponses, GetProfileV1MeProfileGetData, GetProfileV1MeProfileGetResponses, GetSurveyQuestionsV1SurveyQuestionsGetData, GetSurveyQuestionsV1SurveyQuestionsGetResponses, HealthHealthGetData, HealthHealthGetResponses, HistoryV1OpsCampaignsCampaignHistoryGetData, HistoryV1OpsCampaignsCampaignHistoryGetErrors, HistoryV1OpsCampaignsCampaignHistoryGetResponses, ListCampaignsV1OpsCampaignsGetData, ListCampaignsV1OpsCampaignsGetResponses, ListConversationsV1ConversationsGetData, ListConversationsV1ConversationsGetResponses, ListDraftsV1OpsCampaignsCampaignDraftsGetData, ListDraftsV1OpsCampaignsCampaignDraftsGetErrors, ListDraftsV1OpsCampaignsCampaignDraftsGetResponses, ListDrivesV1DrivesGetData, ListDrivesV1DrivesGetResponses, ListFriendsV1SocialFriendsGetData, ListFriendsV1SocialFriendsGetResponses, ListTripsV1TripsGetData, ListTripsV1TripsGetResponses, ListVehiclesV1VehiclesGetData, ListVehiclesV1VehiclesGetResponses, MintLinksV1EmailLinksPostData, MintLinksV1EmailLinksPostErrors, MintLinksV1EmailLinksPostResponses, MintSessionV1LocationsSessionsPostData, MintSessionV1LocationsSessionsPostErrors, MintSessionV1LocationsSessionsPostResponses, MySessionV1LocationsSessionsMineGetData, MySessionV1LocationsSessionsMineGetResponses, OverviewV1OpsOverviewGetData, OverviewV1OpsOverviewGetResponses, PlanTripV1TripsPlanPostData, PlanTripV1TripsPlanPostErrors, PlanTripV1TripsPlanPostResponses, PreviewV1OpsCampaignsCampaignPreviewPostData, PreviewV1OpsCampaignsCampaignPreviewPostErrors, PreviewV1OpsCampaignsCampaignPreviewPostResponses, ReadPreferencesV1EmailPreferencesGetData, ReadPreferencesV1EmailPreferencesGetErrors, ReadPreferencesV1EmailPreferencesGetResponses, RecordConsentsV1MeConsentsPostData, RecordConsentsV1MeConsentsPostErrors, RecordConsentsV1MeConsentsPostResponses, RecordReplyV1OpsRepliesPostData, RecordReplyV1OpsRepliesPostErrors, RecordReplyV1OpsRepliesPostResponses, RemoveFriendV1SocialFriendsFriendshipIdDeleteData, RemoveFriendV1SocialFriendsFriendshipIdDeleteErrors, RemoveFriendV1SocialFriendsFriendshipIdDeleteResponses, ReportMessageV1ConversationsConversationIdMessagesMessageIdReportPostData, ReportMessageV1ConversationsConversationIdMessagesMessageIdReportPostErrors, ReportMessageV1ConversationsConversationIdMessagesMessageIdReportPostResponses, RequestFriendV1SocialFriendsPostData, RequestFriendV1SocialFriendsPostErrors, RequestFriendV1SocialFriendsPostResponses, RespondV1SocialFriendsFriendshipIdRespondPostData, RespondV1SocialFriendsFriendshipIdRespondPostErrors, RespondV1SocialFriendsFriendshipIdRespondPostResponses, ResubscribeV1EmailResubscribePostData, ResubscribeV1EmailResubscribePostErrors, ResubscribeV1EmailResubscribePostResponses, RevenuecatWebhookV1WebhooksRevenuecatPostData, RevenuecatWebhookV1WebhooksRevenuecatPostErrors, RevenuecatWebhookV1WebhooksRevenuecatPostResponses, RevokeSessionV1LocationsSessionsSessionIdDeleteData, RevokeSessionV1LocationsSessionsSessionIdDeleteErrors, RevokeSessionV1LocationsSessionsSessionIdDeleteResponses, SaveDriveV1DrivesPostData, SaveDriveV1DrivesPostErrors, SaveDriveV1DrivesPostResponses, SaveTripV1TripsPostData, SaveTripV1TripsPostErrors, SaveTripV1TripsPostResponses, SendMessageV1ConversationsConversationIdMessagesPostData, SendMessageV1ConversationsConversationIdMessagesPostErrors, SendMessageV1ConversationsConversationIdMessagesPostResponses, SendV1OpsCampaignsCampaignSendPostData, SendV1OpsCampaignsCampaignSendPostErrors, SendV1OpsCampaignsCampaignSendPostResponses, StripeWebhookV1WebhooksStripePostData, StripeWebhookV1WebhooksStripePostErrors, StripeWebhookV1WebhooksStripePostResponses, SubmitOnboardingV1MeOnboardingPostData, SubmitOnboardingV1MeOnboardingPostErrors, SubmitOnboardingV1MeOnboardingPostResponses, SuppressionsV1OpsSuppressionsGetData, SuppressionsV1OpsSuppressionsGetResponses, SuppressV1OpsSuppressionsPostData, SuppressV1OpsSuppressionsPostErrors, SuppressV1OpsSuppressionsPostResponses, UnsubscribeV1EmailUnsubscribePostData, UnsubscribeV1EmailUnsubscribePostErrors, UnsubscribeV1EmailUnsubscribePostResponses, UnsuppressV1OpsSuppressionsEmailDeleteData, UnsuppressV1OpsSuppressionsEmailDeleteErrors, UnsuppressV1OpsSuppressionsEmailDeleteResponses, UpdateDriveV1DrivesDriveIdPatchData, UpdateDriveV1DrivesDriveIdPatchErrors, UpdateDriveV1DrivesDriveIdPatchResponses, UpdateProfileV1MeProfilePutData, UpdateProfileV1MeProfilePutErrors, UpdateProfileV1MeProfilePutResponses, UpdateVehicleV1VehiclesVehicleIdPatchData, UpdateVehicleV1VehiclesVehicleIdPatchErrors, UpdateVehicleV1VehiclesVehicleIdPatchResponses, UpsertDraftV1OpsCampaignsCampaignDraftsPutData, UpsertDraftV1OpsCampaignsCampaignDraftsPutErrors, UpsertDraftV1OpsCampaignsCampaignDraftsPutResponses } from './types.gen';
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
 *
 * Entitlement + funnel snapshot, and the place the server trial is born (ADR-0044).
 *
 * A GET that writes a row is deliberate. Signup happens in Supabase Auth and core has no signup
 * hook, so there is no other moment we reliably observe a new account — and both clients call
 * ``/v1/me`` on launch and immediately after login. ``ensure_trial`` is idempotent and skips
 * anyone with a live subscription, so repeating it on every poll creates at most one row and
 * never one for a paying customer.
 *
 * Anonymous sessions never get a grant: the trial belongs to an account, not a device that has
 * not signed up yet.
 */
export declare const getMeV1MeGet: <ThrowOnError extends boolean = false>(options?: Options<GetMeV1MeGetData, ThrowOnError>) => RequestResult<GetMeV1MeGetResponses, GetMeV1MeGetErrors, ThrowOnError>;
/**
 * DEPRECATED (ADR-0044): the trial is granted by GET /v1/me; this is now a no-op alias
 *
 * Kept so the generated SDKs and any shipped client keep compiling. Nothing requires it.
 *
 * It now delegates to the same idempotent ``ensure_trial`` that ``GET /v1/me`` uses, so an old
 * client calling it cannot create a second trial or move an existing expiry.
 *
 * ``granted`` keeps its original meaning — did THIS call create the grant — so a shipped client
 * that branches on it behaves as it always did: the first call grants, the second reports
 * ``already_used``.
 *
 * @deprecated
 */
export declare const claimTrialV1MeTrialClaimPost: <ThrowOnError extends boolean = false>(options: Options<ClaimTrialV1MeTrialClaimPostData, ThrowOnError>) => RequestResult<ClaimTrialV1MeTrialClaimPostResponses, ClaimTrialV1MeTrialClaimPostErrors, ThrowOnError>;
/**
 * GDPR/CCPA export of the account's data (Art. 15/20) — complete + synchronous
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
 * The paywall offer, without having to trip a 402
 *
 * The same payload a 402 carries, fetchable on purpose.
 *
 * iOS can open its paywall whenever it likes because RevenueCat hands it the offering. The web
 * client had no such route: its paywall renders only from a 402 body, so a signed-in user whose
 * trial had expired could not subscribe from Settings at all — the sole way in was to attempt a
 * gated action and be refused. That is a poor path to ask someone to walk when they have already
 * decided to pay, and it got worse once the US external link made web checkout the one we prefer.
 *
 * Prices are public — they are on the marketing site — so this needs no auth and deliberately
 * carries no per-account state. It is the offer, not an entitlement decision; ``GET /v1/me``
 * remains the only thing that says whether a given account is Pro.
 */
export declare const getPlansV1BillingPlansGet: <ThrowOnError extends boolean = false>(options?: Options<GetPlansV1BillingPlansGetData, ThrowOnError>) => RequestResult<GetPlansV1BillingPlansGetResponses, unknown, ThrowOnError>;
/**
 * Create a Stripe Checkout Session (plain subscription; no trial — ADR-0044)
 *
 * Start a Stripe subscription. Never a trial.
 *
 * The claim/release dance this used to perform is gone with the store trial (ADR-0044): the
 * server granted the trial at signup and it is spent by the time anyone reaches checkout, so
 * there is nothing to claim and nothing to give back if the session fails to create.
 *
 * ``trial_days`` stays on the response for SDK compatibility and is always 0.
 */
export declare const createCheckoutSessionV1BillingCheckoutSessionPost: <ThrowOnError extends boolean = false>(options: Options<CreateCheckoutSessionV1BillingCheckoutSessionPostData, ThrowOnError>) => RequestResult<CreateCheckoutSessionV1BillingCheckoutSessionPostResponses, CreateCheckoutSessionV1BillingCheckoutSessionPostErrors, ThrowOnError>;
/**
 * Create a Stripe Billing Portal session (ADR-0028; Stripe-billed subscriptions only)
 */
export declare const createPortalSessionV1BillingPortalSessionPost: <ThrowOnError extends boolean = false>(options?: Options<CreatePortalSessionV1BillingPortalSessionPostData, ThrowOnError>) => RequestResult<CreatePortalSessionV1BillingPortalSessionPostResponses, unknown, ThrowOnError>;
/**
 * The caller's recorded drives, newest first (owner-only this phase)
 */
export declare const listDrivesV1DrivesGet: <ThrowOnError extends boolean = false>(options?: Options<ListDrivesV1DrivesGetData, ThrowOnError>) => RequestResult<ListDrivesV1DrivesGetResponses, unknown, ThrowOnError>;
/**
 * Upload a finished recording; the server recomputes all stats via the engine
 */
export declare const saveDriveV1DrivesPost: <ThrowOnError extends boolean = false>(options: Options<SaveDriveV1DrivesPostData, ThrowOnError>) => RequestResult<SaveDriveV1DrivesPostResponses, SaveDriveV1DrivesPostErrors, ThrowOnError>;
/**
 * Delete one of the caller's drives (owner-scoped; the stats rollup decrements)
 */
export declare const deleteDriveV1DrivesDriveIdDelete: <ThrowOnError extends boolean = false>(options: Options<DeleteDriveV1DrivesDriveIdDeleteData, ThrowOnError>) => RequestResult<DeleteDriveV1DrivesDriveIdDeleteResponses, DeleteDriveV1DrivesDriveIdDeleteErrors, ThrowOnError>;
/**
 * One of the caller's drives (owner-scoped; 404 otherwise)
 */
export declare const getDriveV1DrivesDriveIdGet: <ThrowOnError extends boolean = false>(options: Options<GetDriveV1DrivesDriveIdGetData, ThrowOnError>) => RequestResult<GetDriveV1DrivesDriveIdGetResponses, GetDriveV1DrivesDriveIdGetErrors, ThrowOnError>;
/**
 * Edit a drive's metadata (title / garage vehicle); stats are immutable
 */
export declare const updateDriveV1DrivesDriveIdPatch: <ThrowOnError extends boolean = false>(options: Options<UpdateDriveV1DrivesDriveIdPatchData, ThrowOnError>) => RequestResult<UpdateDriveV1DrivesDriveIdPatchResponses, UpdateDriveV1DrivesDriveIdPatchErrors, ThrowOnError>;
/**
 * The caller's driving totals (rollup read — never a polyline scan)
 */
export declare const getMyStatsV1MeStatsGet: <ThrowOnError extends boolean = false>(options?: Options<GetMyStatsV1MeStatsGetData, ThrowOnError>) => RequestResult<GetMyStatsV1MeStatsGetResponses, unknown, ThrowOnError>;
/**
 * The caller's garage, newest first
 */
export declare const listVehiclesV1VehiclesGet: <ThrowOnError extends boolean = false>(options?: Options<ListVehiclesV1VehiclesGetData, ThrowOnError>) => RequestResult<ListVehiclesV1VehiclesGetResponses, unknown, ThrowOnError>;
/**
 * Add a vehicle to the caller's garage
 */
export declare const createVehicleV1VehiclesPost: <ThrowOnError extends boolean = false>(options: Options<CreateVehicleV1VehiclesPostData, ThrowOnError>) => RequestResult<CreateVehicleV1VehiclesPostResponses, CreateVehicleV1VehiclesPostErrors, ThrowOnError>;
/**
 * Remove a vehicle; drives that referenced it survive with the link cleared
 */
export declare const deleteVehicleV1VehiclesVehicleIdDelete: <ThrowOnError extends boolean = false>(options: Options<DeleteVehicleV1VehiclesVehicleIdDeleteData, ThrowOnError>) => RequestResult<DeleteVehicleV1VehiclesVehicleIdDeleteResponses, DeleteVehicleV1VehiclesVehicleIdDeleteErrors, ThrowOnError>;
/**
 * Edit one of the caller's vehicles (owner-scoped; 404 otherwise)
 */
export declare const updateVehicleV1VehiclesVehicleIdPatch: <ThrowOnError extends boolean = false>(options: Options<UpdateVehicleV1VehiclesVehicleIdPatchData, ThrowOnError>) => RequestResult<UpdateVehicleV1VehiclesVehicleIdPatchResponses, UpdateVehicleV1VehiclesVehicleIdPatchErrors, ThrowOnError>;
/**
 * The caller's friends graph (accepted / incoming / outgoing / their own blocks)
 */
export declare const listFriendsV1SocialFriendsGet: <ThrowOnError extends boolean = false>(options?: Options<ListFriendsV1SocialFriendsGetData, ThrowOnError>) => RequestResult<ListFriendsV1SocialFriendsGetResponses, unknown, ThrowOnError>;
/**
 * Send a friend request by email (rate-limited)
 */
export declare const requestFriendV1SocialFriendsPost: <ThrowOnError extends boolean = false>(options: Options<RequestFriendV1SocialFriendsPostData, ThrowOnError>) => RequestResult<RequestFriendV1SocialFriendsPostResponses, RequestFriendV1SocialFriendsPostErrors, ThrowOnError>;
/**
 * Accept or decline an incoming request (addressee only; decline deletes)
 */
export declare const respondV1SocialFriendsFriendshipIdRespondPost: <ThrowOnError extends boolean = false>(options: Options<RespondV1SocialFriendsFriendshipIdRespondPostData, ThrowOnError>) => RequestResult<RespondV1SocialFriendsFriendshipIdRespondPostResponses, RespondV1SocialFriendsFriendshipIdRespondPostErrors, ThrowOnError>;
/**
 * Unfriend / cancel a pending request (either party) or lift your block
 */
export declare const removeFriendV1SocialFriendsFriendshipIdDelete: <ThrowOnError extends boolean = false>(options: Options<RemoveFriendV1SocialFriendsFriendshipIdDeleteData, ThrowOnError>) => RequestResult<RemoveFriendV1SocialFriendsFriendshipIdDeleteResponses, RemoveFriendV1SocialFriendsFriendshipIdDeleteErrors, ThrowOnError>;
/**
 * Block the other party of a relationship (invisible to them; idempotent)
 */
export declare const blockUserV1SocialBlocksPost: <ThrowOnError extends boolean = false>(options: Options<BlockUserV1SocialBlocksPostData, ThrowOnError>) => RequestResult<BlockUserV1SocialBlocksPostResponses, BlockUserV1SocialBlocksPostErrors, ThrowOnError>;
/**
 * Live-sharing sessions of accepted friends (the friends-map discovery call)
 */
export declare const friendSessionsV1SocialFriendsSessionsGet: <ThrowOnError extends boolean = false>(options?: Options<FriendSessionsV1SocialFriendsSessionsGetData, ThrowOnError>) => RequestResult<FriendSessionsV1SocialFriendsSessionsGetResponses, unknown, ThrowOnError>;
/**
 * A friend's shared drives (accepted friendships only; vehicle badge + weather chip)
 */
export declare const friendDrivesV1SocialFriendsFriendshipIdDrivesGet: <ThrowOnError extends boolean = false>(options: Options<FriendDrivesV1SocialFriendsFriendshipIdDrivesGetData, ThrowOnError>) => RequestResult<FriendDrivesV1SocialFriendsFriendshipIdDrivesGetResponses, FriendDrivesV1SocialFriendsFriendshipIdDrivesGetErrors, ThrowOnError>;
/**
 * Start a live-sharing session (consent-gated; supersedes any prior session)
 */
export declare const mintSessionV1LocationsSessionsPost: <ThrowOnError extends boolean = false>(options: Options<MintSessionV1LocationsSessionsPostData, ThrowOnError>) => RequestResult<MintSessionV1LocationsSessionsPostResponses, MintSessionV1LocationsSessionsPostErrors, ThrowOnError>;
/**
 * Stop sharing (owner-only; new channel joins are denied immediately)
 */
export declare const revokeSessionV1LocationsSessionsSessionIdDelete: <ThrowOnError extends boolean = false>(options: Options<RevokeSessionV1LocationsSessionsSessionIdDeleteData, ThrowOnError>) => RequestResult<RevokeSessionV1LocationsSessionsSessionIdDeleteResponses, RevokeSessionV1LocationsSessionsSessionIdDeleteErrors, ThrowOnError>;
/**
 * The caller's live session, if any (restores the sharing indicator)
 */
export declare const mySessionV1LocationsSessionsMineGet: <ThrowOnError extends boolean = false>(options?: Options<MySessionV1LocationsSessionsMineGetData, ThrowOnError>) => RequestResult<MySessionV1LocationsSessionsMineGetResponses, unknown, ThrowOnError>;
/**
 * The caller's conversations, newest first (dead DMs are absent)
 */
export declare const listConversationsV1ConversationsGet: <ThrowOnError extends boolean = false>(options?: Options<ListConversationsV1ConversationsGetData, ThrowOnError>) => RequestResult<ListConversationsV1ConversationsGetResponses, unknown, ThrowOnError>;
/**
 * Start a DM (dedup-safe) or a group with accepted friends
 */
export declare const createConversationV1ConversationsPost: <ThrowOnError extends boolean = false>(options: Options<CreateConversationV1ConversationsPostData, ThrowOnError>) => RequestResult<CreateConversationV1ConversationsPostResponses, CreateConversationV1ConversationsPostErrors, ThrowOnError>;
/**
 * History, newest first (members only; 404 otherwise)
 */
export declare const getMessagesV1ConversationsConversationIdMessagesGet: <ThrowOnError extends boolean = false>(options: Options<GetMessagesV1ConversationsConversationIdMessagesGetData, ThrowOnError>) => RequestResult<GetMessagesV1ConversationsConversationIdMessagesGetResponses, GetMessagesV1ConversationsConversationIdMessagesGetErrors, ThrowOnError>;
/**
 * Send a message (sanitized, rate-limited; delivery fans out via Realtime)
 */
export declare const sendMessageV1ConversationsConversationIdMessagesPost: <ThrowOnError extends boolean = false>(options: Options<SendMessageV1ConversationsConversationIdMessagesPostData, ThrowOnError>) => RequestResult<SendMessageV1ConversationsConversationIdMessagesPostResponses, SendMessageV1ConversationsConversationIdMessagesPostErrors, ThrowOnError>;
/**
 * Report a message (members only; goes to the moderation log)
 */
export declare const reportMessageV1ConversationsConversationIdMessagesMessageIdReportPost: <ThrowOnError extends boolean = false>(options: Options<ReportMessageV1ConversationsConversationIdMessagesMessageIdReportPostData, ThrowOnError>) => RequestResult<ReportMessageV1ConversationsConversationIdMessagesMessageIdReportPostResponses, ReportMessageV1ConversationsConversationIdMessagesMessageIdReportPostErrors, ThrowOnError>;
/**
 * Force-upgrade verdict + feature flags for this platform/version
 */
export declare const getConfigV1ConfigGet: <ThrowOnError extends boolean = false>(options: Options<GetConfigV1ConfigGetData, ThrowOnError>) => RequestResult<GetConfigV1ConfigGetResponses, GetConfigV1ConfigGetErrors, ThrowOnError>;
/**
 * Read the email preferences behind an unsubscribe link (no state change)
 */
export declare const readPreferencesV1EmailPreferencesGet: <ThrowOnError extends boolean = false>(options: Options<ReadPreferencesV1EmailPreferencesGetData, ThrowOnError>) => RequestResult<ReadPreferencesV1EmailPreferencesGetResponses, ReadPreferencesV1EmailPreferencesGetErrors, ThrowOnError>;
/**
 * Unsubscribe this address (idempotent; also the RFC 8058 one-click endpoint)
 *
 * Suppresses the address in `public.email_suppressions`, which every marketing send consults — the profile's marketing flag alone would not cover recipients without an account. Safe to call repeatedly: the second call reports the same result as the first. Mailbox providers may POST this URL directly per RFC 8058 (`List-Unsubscribe-Post: List-Unsubscribe=One-Click`); the token is read from the query string, so the form-encoded body they send is ignored.
 */
export declare const unsubscribeV1EmailUnsubscribePost: <ThrowOnError extends boolean = false>(options: Options<UnsubscribeV1EmailUnsubscribePostData, ThrowOnError>) => RequestResult<UnsubscribeV1EmailUnsubscribePostResponses, UnsubscribeV1EmailUnsubscribePostErrors, ThrowOnError>;
/**
 * Undo an unsubscribe from the same link (the 'that was a mistake' path)
 *
 * Lifts the suppression and re-grants marketing consent when the address has an account. Requires the same signed token, so it can only re-subscribe an address that already receives our mail — it is not a sign-up surface.
 */
export declare const resubscribeV1EmailResubscribePost: <ThrowOnError extends boolean = false>(options: Options<ResubscribeV1EmailResubscribePostData, ThrowOnError>) => RequestResult<ResubscribeV1EmailResubscribePostResponses, ResubscribeV1EmailResubscribePostErrors, ThrowOnError>;
/**
 * Mint unsubscribe links for a recipient list (OPERATOR ONLY)
 *
 * Server-side twin of `scripts/marketing_list.py cold`, for the machine assembling a campaign: it needs links, not the production signing key and not a database URL. Both stay here.
 *
 * **Not public.** A token minted for an arbitrary address is one POST away from opting that address out, so an open version of this endpoint would be a mass-unsubscribe button. Authorized by the operator shared secret in the `Authorization` header, compared in constant time, refusing everyone outside `local` when no key is configured.
 *
 * Suppressed addresses come back in `suppressed` with **no link** — handing one back would invite a send to someone who already asked us to stop. Each URL belongs to exactly one recipient; they are not interchangeable, and they should not be logged.
 */
export declare const mintLinksV1EmailLinksPost: <ThrowOnError extends boolean = false>(options: Options<MintLinksV1EmailLinksPostData, ThrowOnError>) => RequestResult<MintLinksV1EmailLinksPostResponses, MintLinksV1EmailLinksPostErrors, ThrowOnError>;
/**
 * Every campaign, newest first
 */
export declare const listCampaignsV1OpsCampaignsGet: <ThrowOnError extends boolean = false>(options?: Options<ListCampaignsV1OpsCampaignsGetData, ThrowOnError>) => RequestResult<ListCampaignsV1OpsCampaignsGetResponses, unknown, ThrowOnError>;
/**
 * Drafts in a campaign
 */
export declare const listDraftsV1OpsCampaignsCampaignDraftsGet: <ThrowOnError extends boolean = false>(options: Options<ListDraftsV1OpsCampaignsCampaignDraftsGetData, ThrowOnError>) => RequestResult<ListDraftsV1OpsCampaignsCampaignDraftsGetResponses, ListDraftsV1OpsCampaignsCampaignDraftsGetErrors, ThrowOnError>;
/**
 * Create or replace one recipient's draft
 *
 * Refuses a draft that already carries an unsubscribe link or an unsubstituted placeholder, at the point it is saved rather than at send time — a bad draft should never reach the table it will later be sent from.
 */
export declare const upsertDraftV1OpsCampaignsCampaignDraftsPut: <ThrowOnError extends boolean = false>(options: Options<UpsertDraftV1OpsCampaignsCampaignDraftsPutData, ThrowOnError>) => RequestResult<UpsertDraftV1OpsCampaignsCampaignDraftsPutResponses, UpsertDraftV1OpsCampaignsCampaignDraftsPutErrors, ThrowOnError>;
/**
 * Remove a draft
 */
export declare const deleteDraftV1OpsCampaignsCampaignDraftsEmailDelete: <ThrowOnError extends boolean = false>(options: Options<DeleteDraftV1OpsCampaignsCampaignDraftsEmailDeleteData, ThrowOnError>) => RequestResult<DeleteDraftV1OpsCampaignsCampaignDraftsEmailDeleteResponses, DeleteDraftV1OpsCampaignsCampaignDraftsEmailDeleteErrors, ThrowOnError>;
/**
 * One draft, body included
 *
 * So a saved draft can be read back and corrected. Without this the only way to fix a typo is to retype the whole body, which is how drafts drift from what was reviewed.
 */
export declare const getDraftV1OpsCampaignsCampaignDraftsEmailGet: <ThrowOnError extends boolean = false>(options: Options<GetDraftV1OpsCampaignsCampaignDraftsEmailGetData, ThrowOnError>) => RequestResult<GetDraftV1OpsCampaignsCampaignDraftsEmailGetResponses, GetDraftV1OpsCampaignsCampaignDraftsEmailGetErrors, ThrowOnError>;
/**
 * What a send would do, changing nothing
 *
 * The review step. Starts from the same plan the send uses, so this is not an approximation of what follows — it is the same decision.
 */
export declare const previewV1OpsCampaignsCampaignPreviewPost: <ThrowOnError extends boolean = false>(options: Options<PreviewV1OpsCampaignsCampaignPreviewPostData, ThrowOnError>) => RequestResult<PreviewV1OpsCampaignsCampaignPreviewPostResponses, PreviewV1OpsCampaignsCampaignPreviewPostErrors, ThrowOnError>;
/**
 * Actually mail people
 *
 * Refuses on any fatal draft problem or missing configuration, with the same checks the preview reports — so nothing can be sent that the review step would have flagged.
 */
export declare const sendV1OpsCampaignsCampaignSendPost: <ThrowOnError extends boolean = false>(options: Options<SendV1OpsCampaignsCampaignSendPostData, ThrowOnError>) => RequestResult<SendV1OpsCampaignsCampaignSendPostResponses, SendV1OpsCampaignsCampaignSendPostErrors, ThrowOnError>;
/**
 * Who was reached, who opted out, who answered
 */
export declare const historyV1OpsCampaignsCampaignHistoryGet: <ThrowOnError extends boolean = false>(options: Options<HistoryV1OpsCampaignsCampaignHistoryGetData, ThrowOnError>) => RequestResult<HistoryV1OpsCampaignsCampaignHistoryGetResponses, HistoryV1OpsCampaignsCampaignHistoryGetErrors, ThrowOnError>;
/**
 * Record a reply, bounce or complaint
 *
 * A bounce or complaint recorded here is ALSO written to the suppression list. This table is the record; that one is the enforcement, and only the latter stops the next send.
 */
export declare const recordReplyV1OpsRepliesPost: <ThrowOnError extends boolean = false>(options: Options<RecordReplyV1OpsRepliesPostData, ThrowOnError>) => RequestResult<RecordReplyV1OpsRepliesPostResponses, RecordReplyV1OpsRepliesPostErrors, ThrowOnError>;
/**
 * Everything at a glance: totals, campaigns, and every person reached
 *
 * Assembled from campaign_sends, outreach_replies and email_suppressions together. Any one of them alone is misleading: sends without suppressions hides who must not be written to again, and replies without sends hides who never answered.
 */
export declare const overviewV1OpsOverviewGet: <ThrowOnError extends boolean = false>(options?: Options<OverviewV1OpsOverviewGetData, ThrowOnError>) => RequestResult<OverviewV1OpsOverviewGetResponses, unknown, ThrowOnError>;
/**
 * The do-not-send list
 *
 * The AUTHORITY on who must not be mailed. Replies recorded as bounces or complaints are a record of why someone stopped; this is the thing that actually stops a send, and it also holds everyone who used the unsubscribe link in an email.
 */
export declare const suppressionsV1OpsSuppressionsGet: <ThrowOnError extends boolean = false>(options?: Options<SuppressionsV1OpsSuppressionsGetData, ThrowOnError>) => RequestResult<SuppressionsV1OpsSuppressionsGetResponses, unknown, ThrowOnError>;
/**
 * Add an address to the do-not-send list
 *
 * For a removal that arrives out of band — a reply asking to stop, a hard bounce, a complaint the provider forwarded. Idempotent: recording the same opt-out twice keeps the original timestamp, because that is when they asked.
 */
export declare const suppressV1OpsSuppressionsPost: <ThrowOnError extends boolean = false>(options: Options<SuppressV1OpsSuppressionsPostData, ThrowOnError>) => RequestResult<SuppressV1OpsSuppressionsPostResponses, SuppressV1OpsSuppressionsPostErrors, ThrowOnError>;
/**
 * Lift a suppression
 *
 * Only for someone who asked to be added back. Removing an opt-out that was not withdrawn is the one action here with no honest justification.
 */
export declare const unsuppressV1OpsSuppressionsEmailDelete: <ThrowOnError extends boolean = false>(options: Options<UnsuppressV1OpsSuppressionsEmailDeleteData, ThrowOnError>) => RequestResult<UnsuppressV1OpsSuppressionsEmailDeleteResponses, UnsuppressV1OpsSuppressionsEmailDeleteErrors, ThrowOnError>;
//# sourceMappingURL=sdk.gen.d.ts.map