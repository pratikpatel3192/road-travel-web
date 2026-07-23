import { Injectable, inject } from '@angular/core';
import {
  type AddStopPreviewRequest,
  type AddStopPreviewResponse,
  type BriefingRequest,
  type BriefingResponse,
  type CheckoutSessionResponse,
  type ConsentInput,
  type ConversationModel,
  type ConversationsResponse,
  type DrivesResponse,
  type FriendshipModel,
  type FriendsResponse,
  type ExploreFeedbackRequest,
  type ExploreRequest,
  type ExploreResponse,
  type MeResponse,
  type MeStatsResponse,
  type MessageModel,
  type MessagesResponse,
  type OnboardingRequest,
  type PaywallResponse,
  type PlanTripRequest,
  type PlanTripResponse,
  type PortalSessionResponse,
  type ProfileResponse,
  type ProfileUpdate,
  type SaveTripRequest,
  type SavedTripModel,
  type SavedTripsResponse,
  type SharedDrivesResponse,
  type SurveyQuestionsResponse,
  type TrialClaimResponse,
  type VehiclesResponse,
  addStopPreviewV1TripsExploreAddStopPreviewPost,
  claimTrialV1MeTrialClaimPost,
  createBriefingV1BriefingsPost,
  deleteTripV1TripsTripIdDelete,
  exploreFeedbackV1TripsExploreFeedbackPost,
  exploreV1TripsExplorePost,
  blockUserV1SocialBlocksPost,
  createConversationV1ConversationsPost,
  friendDrivesV1SocialFriendsFriendshipIdDrivesGet,
  getMessagesV1ConversationsConversationIdMessagesGet,
  getMyStatsV1MeStatsGet,
  listConversationsV1ConversationsGet,
  listDrivesV1DrivesGet,
  listFriendsV1SocialFriendsGet,
  reportMessageV1ConversationsConversationIdMessagesMessageIdReportPost,
  sendMessageV1ConversationsConversationIdMessagesPost,
  listTripsV1TripsGet,
  listVehiclesV1VehiclesGet,
  removeFriendV1SocialFriendsFriendshipIdDelete,
  requestFriendV1SocialFriendsPost,
  respondV1SocialFriendsFriendshipIdRespondPost,
  createCheckoutSessionV1BillingCheckoutSessionPost,
  createPortalSessionV1BillingPortalSessionPost,
  getMeV1MeGet,
  getProfileV1MeProfileGet,
  getSurveyQuestionsV1SurveyQuestionsGet,
  planTripV1TripsPlanPost,
  recordConsentsV1MeConsentsPost,
  saveTripV1TripsPost,
  submitOnboardingV1MeOnboardingPost,
  updateProfileV1MeProfilePut,
} from '@road-travel/sdk';

import { AuthService } from './auth.service';
import { ConfigService } from './config';
import { DeviceService } from './device.service';
import { AccountRequiredError, ApiError, PaywallError } from './errors';

/**
 * Thin wrapper over the generated `@road-travel/sdk` (contracts). Injects the per-env base URL and
 * the Supabase bearer token per call, and surfaces typed results. No LLM/routing logic here — the
 * backend is authoritative (ADR-0011); this just calls it.
 *
 * A 402 (free-tier cap) is turned into a {@link PaywallError} carrying the server's paywall payload,
 * so callers can show the paywall; every other non-2xx becomes an {@link ApiError} with the status.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly config = inject(ConfigService);
  private readonly auth = inject(AuthService);
  private readonly device = inject(DeviceService);

  private options() {
    const headers: Record<string, string> = { 'X-Device-Id': this.device.id };
    const token = this.auth.token;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    // throwOnError stays off so we can map 401/402 to our own errors.
    return { baseUrl: this.config.value.apiBaseUrl, headers };
  }

  private raise(response: Response | undefined, error: unknown): never {
    const status = response?.status ?? 0;
    // ADR-0025 auth wall: a value action from an anonymous/no session -> open the sign-in wall.
    if (status === 401) throw new AccountRequiredError();
    if (status === 402) throw new PaywallError(error as PaywallResponse);
    const message =
      // The core's standard envelope is `{ error: { code, message } }`.
      (error as { error?: { message?: string } } | undefined)?.error?.message ??
      (error as { message?: string } | undefined)?.message ??
      (error as { detail?: string } | undefined)?.detail ??
      `Request failed (${status})`;
    throw new ApiError(status, message);
  }

  /**
   * ADR-0025: start web checkout. The **server** decides whether this account+device gets the
   * 7-day trial (it claims the one-trial-ever grant), collects the card up front, and returns the
   * Stripe Checkout URL to redirect to. `is_pro` only flips via the signed Stripe webhook.
   */
  async createCheckoutSession(period: 'annual' | 'monthly'): Promise<CheckoutSessionResponse> {
    const { data, error, response } = await createCheckoutSessionV1BillingCheckoutSessionPost({
      ...this.options(),
      body: { period },
    });
    if (error || !data) this.raise(response, error);
    return data as CheckoutSessionResponse;
  }

  /**
   * ADR-0028: open Stripe subscription management. Only valid when `/v1/me.subscription.management`
   * is `'stripe'` (409 otherwise); the server derives the portal `return_url` — no client URLs.
   */
  async createPortalSession(): Promise<PortalSessionResponse> {
    const { data, error, response } = await createPortalSessionV1BillingPortalSessionPost(
      this.options(),
    );
    if (error || !data) this.raise(response, error);
    return data as PortalSessionResponse;
  }

  /** Claim the one-trial-ever grant directly (used by the iOS StoreKit flow; web goes via checkout). */
  async claimTrial(platform = 'web'): Promise<TrialClaimResponse> {
    const { data, error, response } = await claimTrialV1MeTrialClaimPost({
      ...this.options(),
      body: { device_id: this.device.id, platform },
    });
    if (error || !data) this.raise(response, error);
    return data as TrialClaimResponse;
  }

  /** Route + sampled points (each with its ETA-hour forecast) + colored segments — for map+timeline. */
  async planTrip(body: PlanTripRequest): Promise<PlanTripResponse> {
    const { data, error, response } = await planTripV1TripsPlanPost({ ...this.options(), body });
    if (error || !data) this.raise(response, error);
    return data as PlanTripResponse;
  }

  /**
   * F-005 Trip Explorer: ranked stop cards along the planned corridor for one intent (Pro —
   * a 402 becomes a {@link PaywallError} exactly like plan/briefings; ADR-0033).
   */
  async explore(body: ExploreRequest): Promise<ExploreResponse> {
    const { data, error, response } = await exploreV1TripsExplorePost({ ...this.options(), body });
    if (error || !data) this.raise(response, error);
    return data as ExploreResponse;
  }

  /** F-005 → F-006 add-a-stop delta preview: added time + arrival + weather-exposure change. */
  async addStopPreview(body: AddStopPreviewRequest): Promise<AddStopPreviewResponse> {
    const { data, error, response } = await addStopPreviewV1TripsExploreAddStopPreviewPost({
      ...this.options(),
      body,
    });
    if (error || !data) this.raise(response, error);
    return data as AddStopPreviewResponse;
  }

  /** F-005 "I wanted something else" drop-box — recorded server-side, never answered (204). */
  async exploreFeedback(body: ExploreFeedbackRequest): Promise<void> {
    const { error, response } = await exploreFeedbackV1TripsExploreFeedbackPost({
      ...this.options(),
      body,
    });
    if (response && !response.ok) this.raise(response, error);
  }

  /** Grounded natural-language briefing + structured facts (F-001). */
  async createBriefing(body: BriefingRequest): Promise<BriefingResponse> {
    const { data, error, response } = await createBriefingV1BriefingsPost({
      ...this.options(),
      body,
    });
    if (error || !data) this.raise(response, error);
    return data as BriefingResponse;
  }

  /** The caller's entitlement + usage snapshot — drives gating and the paywall (F-002). */
  async getMe(): Promise<MeResponse> {
    const { data, error, response } = await getMeV1MeGet({ ...this.options() });
    if (error || !data) this.raise(response, error);
    return data as MeResponse;
  }

  /** Save a planned trip for cross-device sync (login-only; flat anti-abuse ceiling only). */
  async saveTrip(body: SaveTripRequest): Promise<SavedTripModel> {
    const { data, error, response } = await saveTripV1TripsPost({ ...this.options(), body });
    if (error || !data) this.raise(response, error);
    return data as SavedTripModel;
  }

  /** The caller's saved trips, newest first (server-authoritative My Trips, ADR-0029). */
  async listTrips(): Promise<SavedTripsResponse> {
    const { data, error, response } = await listTripsV1TripsGet(this.options());
    if (error || !data) this.raise(response, error);
    return data as SavedTripsResponse;
  }

  // --- F-007 P1: recorded drives + garage + stats (view-only on web; recording is iOS-only) ---

  /** The caller's recorded drives, newest first (server-computed stats + simplified polylines). */
  async listDrives(): Promise<DrivesResponse> {
    const { data, error, response } = await listDrivesV1DrivesGet(this.options());
    if (error || !data) this.raise(response, error);
    return data as DrivesResponse;
  }

  /** The caller's driving totals (the server's trigger-maintained rollup). */
  async myStats(): Promise<MeStatsResponse> {
    const { data, error, response } = await getMyStatsV1MeStatsGet(this.options());
    if (error || !data) this.raise(response, error);
    return data as MeStatsResponse;
  }

  /** The caller's garage, newest first. */
  async listVehicles(): Promise<VehiclesResponse> {
    const { data, error, response } = await listVehiclesV1VehiclesGet(this.options());
    if (error || !data) this.raise(response, error);
    return data as VehiclesResponse;
  }

  /** The caller's friends graph (accepted/incoming/outgoing/their own blocks). */
  async listFriends(): Promise<FriendsResponse> {
    const { data, error, response } = await listFriendsV1SocialFriendsGet(this.options());
    if (error || !data) this.raise(response, error);
    return data as FriendsResponse;
  }

  /** A friend's shared drives (accepted friendships only). */
  async friendDrives(friendshipId: string): Promise<SharedDrivesResponse> {
    const { data, error, response } = await friendDrivesV1SocialFriendsFriendshipIdDrivesGet({
      ...this.options(),
      path: { friendship_id: friendshipId },
    });
    if (error || !data) this.raise(response, error);
    return data as SharedDrivesResponse;
  }

  /** Send a friend request by email. 404 = no account (or that account blocked us —
   * indistinguishable by design); 409 = existing relationship; 429 = daily cap. */
  async requestFriend(email: string): Promise<FriendshipModel> {
    const { data, error, response } = await requestFriendV1SocialFriendsPost({
      ...this.options(),
      body: { email },
    });
    if (error || !data) this.raise(response, error);
    return data as FriendshipModel;
  }

  /** Accept (200) or decline (204 — the request is deleted) an incoming request. */
  async respondFriend(friendshipId: string, accept: boolean): Promise<void> {
    const { error, response } = await respondV1SocialFriendsFriendshipIdRespondPost({
      ...this.options(),
      path: { friendship_id: friendshipId },
      body: { accept },
    });
    if (response && !response.ok) this.raise(response, error);
  }

  /** Unfriend / cancel a pending request / lift one of the caller's blocks. */
  async removeFriend(friendshipId: string): Promise<void> {
    const { error, response } = await removeFriendV1SocialFriendsFriendshipIdDelete({
      ...this.options(),
      path: { friendship_id: friendshipId },
    });
    if (response && !response.ok) this.raise(response, error);
  }

  /** Block the other party of a relationship (invisible to them; idempotent). */
  async blockFriend(friendshipId: string): Promise<void> {
    const { error, response } = await blockUserV1SocialBlocksPost({
      ...this.options(),
      body: { friendship_id: friendshipId },
    });
    if (response && !response.ok) this.raise(response, error);
  }

  // --- F-007 P3 M8 chat (delivery rides Realtime; see AuthService.channel) -----------------------

  /** Start (or dedupe into) the DM behind an accepted friendship. 404 covers pending, blocked,
   * and nonexistent alike — indistinguishable by design. */
  async openDm(friendshipId: string): Promise<ConversationModel> {
    const { data, error, response } = await createConversationV1ConversationsPost({
      ...this.options(),
      body: { kind: 'dm', friendship_id: friendshipId },
    });
    if (error || !data) this.raise(response, error);
    return data as ConversationModel;
  }

  /** Create a group from accepted friendships (2–7 friends) with an optional title. */
  async createGroup(friendshipIds: string[], title: string | null): Promise<ConversationModel> {
    const { data, error, response } = await createConversationV1ConversationsPost({
      ...this.options(),
      body: { kind: 'group', friendship_ids: friendshipIds, title },
    });
    if (error || !data) this.raise(response, error);
    return data as ConversationModel;
  }

  /** The caller's conversations, newest first (dead DMs are absent — server-omitted). */
  async listConversations(): Promise<ConversationsResponse> {
    const { data, error, response } = await listConversationsV1ConversationsGet(this.options());
    if (error || !data) this.raise(response, error);
    return data as ConversationsResponse;
  }

  /** History, newest first (server-capped window; members only, 404 otherwise). */
  async listMessages(conversationId: string): Promise<MessagesResponse> {
    const { data, error, response } = await getMessagesV1ConversationsConversationIdMessagesGet({
      ...this.options(),
      path: { conversation_id: conversationId },
    });
    if (error || !data) this.raise(response, error);
    return data as MessagesResponse;
  }

  /** Send a message (server-sanitized; 429 = rate limit, 404 = dead DM/non-member). */
  async sendMessage(
    conversationId: string,
    body: string,
    driveId: string | null = null,
  ): Promise<MessageModel> {
    const { data, error, response } = await sendMessageV1ConversationsConversationIdMessagesPost({
      ...this.options(),
      path: { conversation_id: conversationId },
      body: { body, drive_id: driveId },
    });
    if (error || !data) this.raise(response, error);
    return data as MessageModel;
  }

  /** Report a message to the moderation log (members only). */
  async reportMessage(conversationId: string, messageId: string): Promise<void> {
    const { error, response } =
      await reportMessageV1ConversationsConversationIdMessagesMessageIdReportPost({
        ...this.options(),
        path: { conversation_id: conversationId, message_id: messageId },
      });
    if (response && !response.ok) this.raise(response, error);
  }

  /** Delete one of the caller's saved trips. Missing/foreign ids 404 (surfaced as ApiError). */
  async deleteTrip(tripId: string): Promise<void> {
    const { error, response } = await deleteTripV1TripsTripIdDelete({
      ...this.options(),
      path: { trip_id: tripId },
    });
    if (response && !response.ok) this.raise(response, error);
  }

  // --- F-003 onboarding / profile / survey / consent ---------------------------------------------

  /** The seeded onboarding survey questions (for the client to render). */
  async getSurveyQuestions(): Promise<SurveyQuestionsResponse> {
    const { data, error, response } = await getSurveyQuestionsV1SurveyQuestionsGet(this.options());
    if (error || !data) this.raise(response, error);
    return data as SurveyQuestionsResponse;
  }

  /** Profile + vehicles + survey answers + consents + available vehicle types. */
  async getProfile(): Promise<ProfileResponse> {
    const { data, error, response } = await getProfileV1MeProfileGet(this.options());
    if (error || !data) this.raise(response, error);
    return data as ProfileResponse;
  }

  /** Update profile (name/display/phone/vehicles/marketing) — onboarding step + Settings. */
  async updateProfile(body: ProfileUpdate): Promise<ProfileResponse> {
    const { data, error, response } = await updateProfileV1MeProfilePut({
      ...this.options(),
      body,
    });
    if (error || !data) this.raise(response, error);
    return data as ProfileResponse;
  }

  /** Complete onboarding (profile + survey + consents; sets onboarded). 400 => consent_required. */
  async submitOnboarding(body: OnboardingRequest): Promise<ProfileResponse> {
    const { data, error, response } = await submitOnboardingV1MeOnboardingPost({
      ...this.options(),
      body,
    });
    if (error || !data) this.raise(response, error);
    return data as ProfileResponse;
  }

  /** Record consent events (Settings toggles, TOS re-accept). */
  async recordConsents(consents: ConsentInput[]): Promise<ProfileResponse> {
    const { data, error, response } = await recordConsentsV1MeConsentsPost({
      ...this.options(),
      body: { consents },
    });
    if (error || !data) this.raise(response, error);
    return data as ProfileResponse;
  }
}
