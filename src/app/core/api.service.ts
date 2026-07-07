import { Injectable, inject } from '@angular/core';
import {
  type BriefingRequest,
  type BriefingResponse,
  type PlanTripRequest,
  type PlanTripResponse,
  createBriefingV1BriefingsPost,
  planTripV1TripsPlanPost,
} from '@road-travel/sdk';

import { AuthService } from './auth.service';
import { ConfigService } from './config';

/**
 * Thin wrapper over the generated `@road-travel/sdk` (contracts). Injects the per-env base URL and
 * the Supabase bearer token per call, and surfaces typed results. No LLM/routing logic here — the
 * backend is authoritative (ADR-0011); this just calls it.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly config = inject(ConfigService);
  private readonly auth = inject(AuthService);

  private options() {
    const headers: Record<string, string> = {};
    const token = this.auth.token;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return { baseUrl: this.config.value.apiBaseUrl, headers, throwOnError: true as const };
  }

  /** Route + sampled points (each with its ETA-hour forecast) + colored segments — for map+timeline. */
  async planTrip(body: PlanTripRequest): Promise<PlanTripResponse> {
    const { data } = await planTripV1TripsPlanPost({ ...this.options(), body });
    return data;
  }

  /** Grounded natural-language briefing + structured facts (F-001). */
  async createBriefing(body: BriefingRequest): Promise<BriefingResponse> {
    const { data } = await createBriefingV1BriefingsPost({ ...this.options(), body });
    return data;
  }
}
