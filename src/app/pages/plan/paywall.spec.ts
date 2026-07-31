import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import type { PaywallResponse } from '@road-travel/sdk';

import { AnalyticsService } from '../../core/analytics.service';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { EntitlementService } from '../../core/entitlement.service';
import { PaywallService } from '../../core/paywall.service';
import { Paywall } from './paywall';

/**
 * ADR-0037: `paywall_viewed` fires when the app-wide paywall actually RENDERS (the null -> payload
 * transition), carries the server's coarse `reason` as `trigger` — matching what iOS passes — and is
 * counted exactly once per appearance.
 */
describe('Paywall (paywall_viewed)', () => {
  const payload = (reason: string): PaywallResponse =>
    ({ reason, message: 'Upgrade to keep planning', plans: [], trial_days: 3 }) as PaywallResponse;

  function render() {
    const paywallService = new PaywallService();
    const analytics = { capture: vi.fn() };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [Paywall],
      providers: [
        { provide: PaywallService, useValue: paywallService },
        { provide: AnalyticsService, useValue: analytics },
        { provide: ApiService, useValue: {} },
        { provide: AuthService, useValue: { configured: signal(true), hasRealAccount: signal(true), passkeySupported: false } },
        { provide: EntitlementService, useValue: { trialEligible: signal(true) } },
      ],
    });
    const fixture = TestBed.createComponent(Paywall);
    fixture.detectChanges();
    return { fixture, paywallService, analytics };
  }

  it('emits nothing while no paywall is showing', () => {
    const { analytics } = render();
    expect(analytics.capture).not.toHaveBeenCalled();
  });

  it('emits paywall_viewed with the server reason as the trigger', () => {
    const { fixture, paywallService, analytics } = render();
    paywallService.show(payload('subscription_required'));
    fixture.detectChanges();
    expect(analytics.capture).toHaveBeenCalledWith('paywall_viewed', {
      trigger: 'subscription_required',
    });
  });

  it('counts one view per appearance, not per re-render', () => {
    const { fixture, paywallService, analytics } = render();
    paywallService.show(payload('route_cap'));
    fixture.detectChanges();
    fixture.detectChanges(); // an entitlement refresh / plan selection must not re-count
    expect(analytics.capture).toHaveBeenCalledTimes(1);

    // Dismiss re-arms it: the NEXT 402 is a new view.
    paywallService.dismiss();
    fixture.detectChanges();
    paywallService.show(payload('route_cap'));
    fixture.detectChanges();
    expect(analytics.capture).toHaveBeenCalledTimes(2);
  });
});
