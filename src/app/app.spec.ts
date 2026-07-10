import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';
import { AuthService } from './core/auth.service';

/**
 * The header is the app-wide "am I signed in?" signal (ADR-0025 funnel): a guest (including the
 * silent ANONYMOUS session) sees a "Sign in" CTA; only a real account sees its email + Settings +
 * Sign out. Regression: `isAuthenticated()` is true for anonymous sessions too, so gating on it
 * made signed-out and signed-in look identical.
 */
class FakeAuth {
  readonly configured = signal(true);
  private readonly _user = signal<{ email: string | null; anon: boolean } | null>({
    email: null,
    anon: true,
  });
  readonly isAuthenticated = computed(() => !!this._user());
  readonly isAnonymous = computed(() => !!this._user()?.anon);
  readonly hasRealAccount = computed(() => this.isAuthenticated() && !this.isAnonymous());
  readonly email = computed(() => this._user()?.email ?? null);
  signOutCalls = 0;

  signInAs(email: string): void {
    this._user.set({ email, anon: false });
  }
  async signOut(): Promise<void> {
    this.signOutCalls += 1;
    this._user.set({ email: null, anon: true });
  }
}

describe('App header auth affordance', () => {
  let auth: FakeAuth;

  beforeEach(async () => {
    auth = new FakeAuth();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
  });

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows a Sign in CTA for an anonymous (guest) session — never Sign out', () => {
    const el = render();
    const nav = el.querySelector('.site-nav')!;
    expect(nav.textContent).toContain('Sign in');
    expect(nav.textContent).not.toContain('Sign out');
  });

  it('shows the account email, Settings, and Sign out once a real account exists', () => {
    auth.signInAs('driver@example.com');
    const el = render();
    const nav = el.querySelector('.site-nav')!;
    expect(nav.textContent).toContain('driver@example.com');
    expect(nav.textContent).toContain('Settings');
    expect(nav.textContent).toContain('Sign out');
    expect(nav.textContent).not.toContain('Sign in');
  });

  it('drops back to the Sign in CTA after signing out', async () => {
    auth.signInAs('driver@example.com');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement)
      .querySelectorAll<HTMLButtonElement>('.site-nav button')
      .forEach((b) => b.textContent?.includes('Sign out') && b.click());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(auth.signOutCalls).toBe(1);
    const nav = (fixture.nativeElement as HTMLElement).querySelector('.site-nav')!;
    expect(nav.textContent).toContain('Sign in');
    expect(nav.textContent).not.toContain('driver@example.com');
  });
});
