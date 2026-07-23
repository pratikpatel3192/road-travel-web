import type { Client, ClientMeta, Options as Options2, RequestResult, TDataShape } from './client';
import type { AddStopPreviewV1TripsExploreAddStopPreviewPostData, AddStopPreviewV1TripsExploreAddStopPreviewPostErrors, AddStopPreviewV1TripsExploreAddStopPreviewPostResponses, BlockUserV1SocialBlocksPostData, BlockUserV1SocialBlocksPostErrors, BlockUserV1SocialBlocksPostResponses, ClaimTrialV1MeTrialClaimPostData, ClaimTrialV1MeTrialClaimPostErrors, ClaimTrialV1MeTrialClaimPostResponses, CreateBriefingV1BriefingsPostData, CreateBriefingV1BriefingsPostErrors, CreateBriefingV1BriefingsPostResponses, CreateCheckoutSessionV1BillingCheckoutSessionPostData, CreateCheckoutSessionV1BillingCheckoutSessionPostErrors, CreateCheckoutSessionV1BillingCheckoutSessionPostResponses, CreateConversationV1ConversationsPostData, CreateConversationV1ConversationsPostErrors, CreateConversationV1ConversationsPostResponses, CreatePortalSessionV1BillingPortalSessionPostData, CreatePortalSessionV1BillingPortalSessionPostResponses, CreateVehicleV1VehiclesPostData, CreateVehicleV1VehiclesPostErrors, CreateVehicleV1VehiclesPostResponses, DeleteAccountV1AccountDeleteData, DeleteAccountV1AccountDeleteResponses, DeleteDriveV1DrivesDriveIdDeleteData, DeleteDriveV1DrivesDriveIdDeleteErrors, DeleteDriveV1DrivesDriveIdDeleteResponses, DeleteTripV1TripsTripIdDeleteData, DeleteTripV1TripsTripIdDeleteErrors, DeleteTripV1TripsTripIdDeleteResponses, DeleteVehicleV1VehiclesVehicleIdDeleteData, DeleteVehicleV1VehiclesVehicleIdDeleteErrors, DeleteVehicleV1VehiclesVehicleIdDeleteResponses, ExploreFeedbackV1TripsExploreFeedbackPostData, ExploreFeedbackV1TripsExploreFeedbackPostErrors, ExploreFeedbackV1TripsExploreFeedbackPostResponses, ExploreV1TripsExplorePostData, ExploreV1TripsExplorePostErrors, ExploreV1TripsExplorePostResponses, ExportAccountV1AccountExportPostData, ExportAccountV1AccountExportPostResponses, FriendDrivesV1SocialFriendsFriendshipIdDrivesGetData, FriendDrivesV1SocialFriendsFriendshipIdDrivesGetErrors, FriendDrivesV1SocialFriendsFriendshipIdDrivesGetResponses, FriendSessionsV1SocialFriendsSessionsGetData, FriendSessionsV1SocialFriendsSessionsGetResponses, GetDriveV1DrivesDriveIdGetData, GetDriveV1DrivesDriveIdGetErrors, GetDriveV1DrivesDriveIdGetResponses, GetMessagesV1ConversationsConversationIdMessagesGetData, GetMessagesV1ConversationsConversationIdMessagesGetErrors, GetMessagesV1ConversationsConversationIdMessagesGetResponses, GetMeV1MeGetData, GetMeV1MeGetErrors, GetMeV1MeGetResponses, GetMyStatsV1MeStatsGetData, GetMyStatsV1MeStatsGetResponses, GetProfileV1MeProfileGetData, GetProfileV1MeProfileGetResponses, GetSurveyQuestionsV1SurveyQuestionsGetData, GetSurveyQuestionsV1SurveyQuestionsGetResponses, HealthHealthGetData, HealthHealthGetResponses, ListConversationsV1ConversationsGetData, ListConversationsV1ConversationsGetResponses, ListDrivesV1DrivesGetData, ListDrivesV1DrivesGetResponses, ListFriendsV1SocialFriendsGetData, ListFriendsV1SocialFriendsGetResponses, ListTripsV1TripsGetData, ListTripsV1TripsGetResponses, ListVehiclesV1VehiclesGetData, ListVehiclesV1VehiclesGetResponses, MintSessionV1LocationsSessionsPostData, MintSessionV1LocationsSessionsPostErrors, MintSessionV1LocationsSessionsPostResponses, MySessionV1LocationsSessionsMineGetData, MySessionV1LocationsSessionsMineGetResponses, PlanTripV1TripsPlanPostData, PlanTripV1TripsPlanPostErrors, PlanTripV1TripsPlanPostResponses, RecordConsentsV1MeConsentsPostData, RecordConsentsV1MeConsentsPostErrors, RecordConsentsV1MeConsentsPostResponses, RemoveFriendV1SocialFriendsFriendshipIdDeleteData, RemoveFriendV1SocialFriendsFriendshipIdDeleteErrors, RemoveFriendV1SocialFriendsFriendshipIdDeleteResponses, ReportMessageV1ConversationsConversationIdMessagesMessageIdReportPostData, ReportMessageV1ConversationsConversationIdMessagesMessageIdReportPostErrors, ReportMessageV1ConversationsConversationIdMessagesMessageIdReportPostResponses, RequestFriendV1SocialFriendsPostData, RequestFriendV1SocialFriendsPostErrors, RequestFriendV1SocialFriendsPostResponses, RespondV1SocialFriendsFriendshipIdRespondPostData, RespondV1SocialFriendsFriendshipIdRespondPostErrors, RespondV1SocialFriendsFriendshipIdRespondPostResponses, RevenuecatWebhookV1WebhooksRevenuecatPostData, RevenuecatWebhookV1WebhooksRevenuecatPostErrors, RevenuecatWebhookV1WebhooksRevenuecatPostResponses, RevokeSessionV1LocationsSessionsSessionIdDeleteData, RevokeSessionV1LocationsSessionsSessionIdDeleteErrors, RevokeSessionV1LocationsSessionsSessionIdDeleteResponses, SaveDriveV1DrivesPostData, SaveDriveV1DrivesPostErrors, SaveDriveV1DrivesPostResponses, SaveTripV1TripsPostData, SaveTripV1TripsPostErrors, SaveTripV1TripsPostResponses, SendMessageV1ConversationsConversationIdMessagesPostData, SendMessageV1ConversationsConversationIdMessagesPostErrors, SendMessageV1ConversationsConversationIdMessagesPostResponses, StripeWebhookV1WebhooksStripePostData, StripeWebhookV1WebhooksStripePostErrors, StripeWebhookV1WebhooksStripePostResponses, SubmitOnboardingV1MeOnboardingPostData, SubmitOnboardingV1MeOnboardingPostErrors, SubmitOnboardingV1MeOnboardingPostResponses, UpdateDriveV1DrivesDriveIdPatchData, UpdateDriveV1DrivesDriveIdPatchErrors, UpdateDriveV1DrivesDriveIdPatchResponses, UpdateProfileV1MeProfilePutData, UpdateProfileV1MeProfilePutErrors, UpdateProfileV1MeProfilePutResponses, UpdateVehicleV1VehiclesVehicleIdPatchData, UpdateVehicleV1VehiclesVehicleIdPatchErrors, UpdateVehicleV1VehiclesVehicleIdPatchResponses } from './types.gen';
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
 * Create a Stripe Checkout Session (card up front; server decides the 7-day trial)
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
//# sourceMappingURL=sdk.gen.d.ts.map