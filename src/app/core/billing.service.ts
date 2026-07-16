import { Injectable, inject } from '@angular/core';
import type { PlanOption } from '@road-travel/sdk';

import { AuthService } from './auth.service';
import { ConfigService } from './config';
import { EntitlementService } from './entitlement.service';

/**
 * RevenueCat Web Billing purchase flow (F-002, ADR-0021). Configures RevenueCat with the Supabase
 * `user_id` as the `appUserId` — the SAME id the RevenueCat webhook writes as
 * `revenuecat_app_user_id` — so a completed purchase flips `entitlements.is_pro` for this user
 * server-side. On success we `refresh()` `/v1/me`, which now reports Pro.
 *
 * **Subscribing requires a real account** (ADR-0019): an anonymous user must sign in first, so Pro
 * is recoverable and syncs. Absent a `revenueCatWebApiKey`, billing is disabled and the paywall is
 * informational (the app still works on the free tier).
 */
@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly config = inject(ConfigService);
  private readonly auth = inject(AuthService);
  private readonly entitlement = inject(EntitlementService);

  // Lazily-created RevenueCat Purchases instance (dynamic import keeps it out of the initial bundle).
  private purchases: unknown = null;

  get configured(): boolean {
    return !!this.config.value.revenueCatWebApiKey;
  }

  /** Purchase the plan. Resolves on success (entitlement refreshed) or throws a friendly Error. */
  async purchase(plan: PlanOption): Promise<void> {
    if (!this.configured) {
      throw new Error('Subscriptions are not available in this environment yet.');
    }
    if (!this.auth.hasRealAccount()) {
      // Server also enforces this; surface it early so the UI can route to sign-in.
      throw new Error('Please sign in to subscribe — your subscription needs an account.');
    }
    const userId = this.auth.userId;
    if (!userId) throw new Error('No user session — please reload and try again.');

    const { Purchases } = await import('@revenuecat/purchases-js');
    if (!this.purchases) {
      this.purchases = Purchases.configure(this.config.value.revenueCatWebApiKey, userId);
    }
    const purchases = this.purchases as {
      getOfferings: (p?: unknown) => Promise<{
        current?: { availablePackages: RcPackage[] };
        all: Record<string, { availablePackages: RcPackage[] }>;
      }>;
      purchase: (p: { rcPackage: RcPackage }) => Promise<unknown>;
    };

    const offerings = await purchases.getOfferings();
    const pkg = this.findPackage(offerings, plan);
    if (!pkg) throw new Error('That plan is not available right now. Please try again later.');

    await purchases.purchase({ rcPackage: pkg });
    // The RevenueCat webhook has flipped is_pro server-side; pull the fresh state.
    await this.entitlement.refresh();
  }

  private findPackage(
    offerings: {
      current?: { availablePackages: RcPackage[] };
      all: Record<string, { availablePackages: RcPackage[] }>;
    },
    plan: PlanOption,
  ): RcPackage | null {
    const wantOffering = this.config.value.revenueCatOfferingId;
    const offering = wantOffering ? offerings.all[wantOffering] : offerings.current;
    const packages = offering?.availablePackages ?? [];
    // Match the server-declared product id (wr_annual / wr_monthly) to the RevenueCat product.
    return (
      packages.find((p) => p.webBillingProduct?.identifier === plan.product_id) ??
      packages.find((p) => p.rcBillingProduct?.identifier === plan.product_id) ??
      null
    );
  }
}

interface RcPackage {
  identifier: string;
  webBillingProduct?: { identifier: string };
  rcBillingProduct?: { identifier: string };
}
