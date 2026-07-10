import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type ActivatedRouteSnapshot, type RouterStateSnapshot, UrlTree } from '@angular/router';

import { authGuard, realAccountGuard } from './auth.guard';
import { AuthService } from './auth.service';

/**
 * ADR-0025 §1: anyone may browse and enter a trip (/app allows the silent ANONYMOUS session), but
 * Recent / Saved / Settings are LOGIN-ONLY — they need a real (non-anonymous) account. Guests get
 * bounced to /login, not shown the page.
 */
class FakeAuth {
  readonly configured = signal(true);
  private readonly _user = signal<{ anon: boolean } | null>(null);
  readonly isAuthenticated = computed(() => !!this._user());
  readonly isAnonymous = computed(() => !!this._user()?.anon);
  readonly hasRealAccount = computed(() => this.isAuthenticated() && !this.isAnonymous());

  asGuest(): void {
    this._user.set({ anon: true });
  }
  asAccount(): void {
    this._user.set({ anon: false });
  }
  asUnconfigured(): void {
    this.configured.set(false);
    this._user.set(null);
  }
}

const snapshot = {} as ActivatedRouteSnapshot;
const state = {} as RouterStateSnapshot;

describe('route guards (ADR-0025 auth wall)', () => {
  let auth: FakeAuth;

  beforeEach(() => {
    auth = new FakeAuth();
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: auth }] });
  });

  function run(guard: typeof authGuard): boolean | UrlTree {
    return TestBed.runInInjectionContext(() => guard(snapshot, state)) as boolean | UrlTree;
  }

  describe('authGuard (/app — browsing is open)', () => {
    it('lets an anonymous session through', () => {
      auth.asGuest();
      expect(run(authGuard)).toBe(true);
    });

    it('bounces a signed-out visitor to /login', () => {
      const result = run(authGuard);
      expect(result).toBeInstanceOf(UrlTree);
    });
  });

  describe('realAccountGuard (/saved, /settings — login-only)', () => {
    it('bounces an ANONYMOUS session to /login (guests are not signed in)', () => {
      auth.asGuest();
      const result = run(realAccountGuard);
      expect(result).toBeInstanceOf(UrlTree);
      expect((result as UrlTree).toString()).toContain('/login');
    });

    it('lets a real account through', () => {
      auth.asAccount();
      expect(run(realAccountGuard)).toBe(true);
    });

    it('allows local dev when auth is not configured', () => {
      auth.asUnconfigured();
      expect(run(realAccountGuard)).toBe(true);
    });
  });
});
