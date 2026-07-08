import { Injectable, inject } from '@angular/core';
import {
  type BriefingRequest,
  type BriefingResponse,
  type MeResponse,
  type PaywallResponse,
  type PlanTripRequest,
  type PlanTripResponse,
  type SaveTripRequest,
  type SavedTripModel,
  createBriefingV1BriefingsPost,
  getMeV1MeGet,
  planTripV1TripsPlanPost,
  saveTripV1TripsPost,
} from '@road-travel/sdk';

import { AuthService } from './auth.service';
import { ConfigService } from './config';
import { ApiError, PaywallError } from './errors';

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

  private options() {
    const headers: Record<string, string> = {};
    const token = this.auth.token;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    // throwOnError stays off so we can map 402 -> PaywallError ourselves.
    return { baseUrl: this.config.value.apiBaseUrl, headers };
  }

  private raise(response: Response | undefined, error: unknown): never {
    const status = response?.status ?? 0;
    if (status === 402) throw new PaywallError(error as PaywallResponse);
    const message =
      (error as { message?: string } | undefined)?.message ??
      (error as { detail?: string } | undefined)?.detail ??
      `Request failed (${status})`;
    throw new ApiError(status, message);
  }

  /** Route + sampled points (each with its ETA-hour forecast) + colored segments — for map+timeline. */
  async planTrip(body: PlanTripRequest): Promise<PlanTripResponse> {
    const { data, error, response } = await planTripV1TripsPlanPost({ ...this.options(), body });
    if (error || !data) this.raise(response, error);
    return data as PlanTripResponse;
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

  /** Save a planned trip for cross-device sync; a 402 here is the save-cap paywall (F-002). */
  async saveTrip(body: SaveTripRequest): Promise<SavedTripModel> {
    const { data, error, response } = await saveTripV1TripsPost({ ...this.options(), body });
    if (error || !data) this.raise(response, error);
    return data as SavedTripModel;
  }
}
