import { Injectable, inject } from '@angular/core';
import {
  type AddStopPreviewRequest,
  type AddStopPreviewResponse,
  type BriefingRequest,
  type BriefingResponse,
  type CheckoutSessionResponse,
  type ConsentInput,
  type DrivesResponse,
  type ExploreFeedbackRequest,
  type ExploreRequest,
  type ExploreResponse,
  type ItineraryBriefingRequest,
  type ItineraryBriefingResponse,
  type MeResponse,
  type OutlookRequest,
  type OutlookResponse,
  type MeStatsResponse,
  type OnboardingRequest,
  type PaywallResponse,
  type PlanItineraryRequest,
  type PlanItineraryResponse,
  type PlanTripRequest,
  type PlanTripResponse,
  type PortalSessionResponse,
  type ProfileResponse,
  type ProfileUpdate,
  type SaveTripRequest,
  type SaveTripSnapshotRequest,
  type SavedTripModel,
  type SavedTripsResponse,
  type SurveyQuestionsResponse,
  type TrialClaimResponse,
  type TripSnapshotResponse,
  type VehiclesResponse,
  addStopPreviewV1TripsExploreAddStopPreviewPost,
  claimTrialV1MeTrialClaimPost,
  createBriefingV1BriefingsPost,
  createItineraryBriefingV1BriefingsItineraryPost,
  deleteTripV1TripsTripIdDelete,
  exploreFeedbackV1TripsExploreFeedbackPost,
  exploreV1TripsExplorePost,
  getMyStatsV1MeStatsGet,
  listDrivesV1DrivesGet,
  listTripsV1TripsGet,
  listVehiclesV1VehiclesGet,
  createCheckoutSessionV1BillingCheckoutSessionPost,
  createPortalSessionV1BillingPortalSessionPost,
  getPlansV1BillingPlansGet,
  getMeV1MeGet,
  getProfileV1MeProfileGet,
  getSurveyQuestionsV1SurveyQuestionsGet,
  getTripSnapshotV1TripsTripIdSnapshotGet,
  planItineraryV1TripsPlanItineraryPost,
  planTripV1TripsPlanPost,
  tripOutlookV1TripsOutlookPost,
  recordConsentsV1MeConsentsPost,
  saveTripSnapshotV1TripsTripIdSnapshotPut,
  saveTripV1TripsPost,
  submitOnboardingV1MeOnboardingPost,
  updateProfileV1MeProfilePut,
} from '@road-travel/sdk';

import { AuthService } from './auth.service';
import { ConfigService } from './config';
import type { CampaignTouch } from './attribution.service';
import { DeviceService } from './device.service';
import { AccountRequiredError, ApiError, PaywallError } from './errors';
import { ReferralService } from './referral.service';

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
  private readonly referral = inject(ReferralService);

  private options() {
    // X-Platform is declared, never inferred. The server used to guess it from whether
    // X-Device-Id was present — "ios" if it was, "web" if not — and since this client sends a
    // device id on every call while the iOS app sent none, every signup was recorded as the
    // opposite platform.
    const headers: Record<string, string> = {
      'X-Device-Id': this.device.id,
      'X-Platform': 'web',
    };
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
    const code = (error as { error?: { code?: string } } | undefined)?.error?.code;
    throw new ApiError(status, message, code);
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
   * The paywall offer, fetched deliberately rather than by tripping a 402.
   *
   * The paywall component renders from a `PaywallResponse`, and until now the only way to obtain
   * one was to attempt a gated action and be refused — so a signed-in user whose trial had expired
   * could not subscribe from Settings at all. iOS never had that problem: RevenueCat hands it the
   * offering. This is the offer only; `GET /v1/me` remains the sole authority on entitlement.
   */
  async getPlans(): Promise<PaywallResponse> {
    const { data, error, response } = await getPlansV1BillingPlansGet(this.options());
    if (error || !data) this.raise(response, error);
    return data as PaywallResponse;
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
  /**
   * @deprecated ADR-0044 — the trial is granted server-side by `GET /v1/me`. Nothing calls this;
   * it is kept only so the vendored SDK surface stays stable. The endpoint itself is now an
   * idempotent alias for the same grant, so calling it cannot create a second trial.
   */
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
   * The same trip, but one plan PER TRAVEL DAY — each routed and forecast on the instant that day
   * actually sets off.
   *
   * Not a flag on {@link planTrip}, and not a loop of `planTrip` calls on the client. A flag would
   * make one response mean two different things; a client-side loop would put the leg derivation
   * and the per-day departure arithmetic in two places, and the whole point of this endpoint is
   * that the server derives the days from the SAME body `/plan` is sent.
   *
   * A day past the forecast horizon comes back with `beyond_forecast` and no plan, and one
   * unroutable day carries its own `error` while the rest still arrive — so callers must read each
   * day's state rather than the presence of `plan` alone.
   */
  async planItinerary(body: PlanItineraryRequest): Promise<PlanItineraryResponse> {
    const { data, error, response } = await planItineraryV1TripsPlanItineraryPost({
      ...this.options(),
      body,
    });
    if (error || !data) this.raise(response, error);
    return data as PlanItineraryResponse;
  }

  /**
   * Typical conditions along a route for a date past the forecast horizon.
   *
   * A separate call returning a separate shape, not a flag on planTrip: an outlook is a different
   * KIND of answer, and keeping the two apart is what stops one being rendered as the other.
   */
  async tripOutlook(body: OutlookRequest): Promise<OutlookResponse> {
    const { data, error, response } = await tripOutlookV1TripsOutlookPost({
      ...this.options(),
      body,
    });
    if (error || !data) this.raise(response, error);
    return data as OutlookResponse;
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

  /**
   * The same briefing, but for a trip driven over several days — each day narrated from ITS OWN
   * date's forecast.
   *
   * Takes the body {@link planItinerary} takes, not the body {@link createBriefing} takes, and that
   * is the whole difference: `/v1/briefings` has one `departure_at` to reason from, so on a trip
   * with overnight stops it describes the last day using the first day's weather — the substitution
   * the day-by-day planning removed from the map and the timeline, left standing in the most
   * confidently-worded box on the screen.
   *
   * The response carries every travel day's own facts, a whole-trip rollup, and prose covering all
   * of them. Days nobody forecasts yet come back counted and named rather than omitted, so a caller
   * must read each day's state instead of assuming a day without facts is a calm one.
   *
   * The body is the planning one WIDENED by `previous_snapshot` — the whole-trip counterpart of
   * `createBriefing`'s `previous_facts`. Send back the `snapshot` the last briefing of this same
   * trip returned and the response carries a `diff`; send nothing and it carries none, which is the
   * honest answer for a trip being looked at for the first time.
   */
  async createItineraryBriefing(
    body: ItineraryBriefingRequest,
  ): Promise<ItineraryBriefingResponse> {
    const { data, error, response } = await createItineraryBriefingV1BriefingsItineraryPost({
      ...this.options(),
      body,
    });
    if (error || !data) this.raise(response, error);
    return data as ItineraryBriefingResponse;
  }

  /** The caller's entitlement + usage snapshot — drives gating and the paywall (F-002). */
  /**
   * ADR-0048: report one campaign arrival. Fire-and-forget — resolves false instead of throwing.
   *
   * Raw `fetch` rather than the generated SDK, deliberately: `@road-travel/sdk` has no operation
   * for this endpoint until the contract is regenerated, and blocking marketing capture on a
   * cross-repo SDK round-trip would be the wrong dependency. Swap to the generated call when it
   * exists — the shape is already identical, headers included.
   *
   * Never throws. A failed attribution post must not surface anywhere near the user, and there is
   * nothing to retry against: the server dedupes by (visitor, campaign), so the next drain that
   * succeeds reports the same arrival.
   */
  async recordAttributionTouch(touch: CampaignTouch): Promise<boolean> {
    const { baseUrl, headers } = this.options();
    try {
      const res = await fetch(`${baseUrl}/v1/attribution/touch`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(touch),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * The entitlement + funnel snapshot, and — since ADR-0045 — where a referral is attributed.
   *
   * `X-Referrer` rides only this call, because `/v1/me` is the only endpoint that reads it. It is
   * sent EVERY time rather than once: the server's first-touch-wins rule makes repetition a no-op,
   * and that is cheaper and more reliable than tracking on the client whether we already sent it —
   * which would need its own persisted flag, and would lose the attribution if the one call
   * carrying it happened to fail.
   */
  async getMe(): Promise<MeResponse> {
    const options = this.options();
    const ref = this.referral.slug;
    if (ref) options.headers['X-Referrer'] = ref;
    const { data, error, response } = await getMeV1MeGet(options);
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

  /**
   * A saved trip's last planned result, exactly as a client stored it — one read, nothing routed or
   * forecast. A 404 carries the reason in {@link ApiError.code}: `snapshot_not_found` (plan the trip)
   * or `trip_not_found` (the trip itself is gone).
   */
  async getTripSnapshot(tripId: string): Promise<TripSnapshotResponse> {
    const { data, error, response } = await getTripSnapshotV1TripsTripIdSnapshotGet({
      ...this.options(),
      path: { trip_id: tripId },
    });
    if (error || !data) this.raise(response, error);
    return data as TripSnapshotResponse;
  }

  /**
   * Store the result on screen as the trip's snapshot, so every device opens it without re-planning.
   * 409 `trip_changed` means the trip moved on after this result was planned (another device
   * changed its stops or departure); the caller drops it.
   */
  async saveTripSnapshot(tripId: string, body: SaveTripSnapshotRequest): Promise<void> {
    const { error, response } = await saveTripSnapshotV1TripsTripIdSnapshotPut({
      ...this.options(),
      path: { trip_id: tripId },
      body,
    });
    if (response && !response.ok) this.raise(response, error);
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

  // --- F-007 P3 M8 chat (delivery rides Realtime; see AuthService.channel) -----------------------

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
