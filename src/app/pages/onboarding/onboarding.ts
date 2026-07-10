import { Component, computed, effect, inject, signal } from '@angular/core';
import type { ConsentInput, ProfileResponse, SurveyQuestionModel } from '@road-travel/sdk';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { EntitlementService } from '../../core/entitlement.service';
import { ProfileService } from '../../core/profile.service';

/**
 * First-time onboarding form (F-003, ADR-0023). Shown app-wide once a user signs in with a real
 * account and `/v1/me.onboarded` is false. Soft/skippable: only the TOS + Privacy checkbox is
 * required (it gates both Finish and Skip); first/last name gate Finish only; everything else is
 * optional. Submitting sets `onboarded` server-side; the client refreshes `/v1/me` and dismisses.
 */
@Component({
  selector: 'app-onboarding',
  template: `
    @if (visible()) {
      <div class="overlay">
        <div class="sheet" role="dialog" aria-modal="true">
          <img class="brand-logo brand-logo-light" src="logo-horizontal-light-2x.png"
               srcset="logo-horizontal-light-2x.png 2x" alt="Road Travel" />
          <img class="brand-logo brand-logo-dark" src="logo-horizontal-dark-2x.png"
               srcset="logo-horizontal-dark-2x.png 2x" alt="Road Travel" />
          <h2>Welcome to Road Travel</h2>
          <p class="sub">A few quick details to personalize your drives. You can skip and finish later.</p>

          <div class="grid2">
            <label>First name*
              <input [value]="firstName()" (input)="firstName.set($any($event.target).value)" />
            </label>
            <label>Last name*
              <input [value]="lastName()" (input)="lastName.set($any($event.target).value)" />
            </label>
            <label>Display name
              <input [value]="displayName()" (input)="displayName.set($any($event.target).value)" />
            </label>
            <label>Phone
              <input type="tel" [value]="phone()" (input)="phone.set($any($event.target).value)" />
            </label>
          </div>

          <div class="block">
            <span class="lbl">Your vehicles</span>
            <div class="chips">
              @for (v of vehicleTypes(); track v.code) {
                <button
                  type="button"
                  class="chip"
                  [class.on]="vehicles().has(v.code)"
                  (click)="toggleVehicle(v.code)"
                >{{ v.label }}</button>
              }
            </div>
          </div>

          @for (q of questions(); track q.key) {
            <div class="block">
              <span class="lbl">{{ q.prompt }}</span>
              <div class="chips">
                @for (o of q.options; track o.value) {
                  <button
                    type="button"
                    class="chip"
                    [class.on]="isChosen(q, o.value)"
                    (click)="choose(q, o.value)"
                  >{{ o.label }}</button>
                }
              </div>
            </div>
          }

          <label class="check required">
            <input type="checkbox" [checked]="agreed()" (change)="agreed.set($any($event.target).checked)" />
            <span>I agree to the <a href="/privacy" target="_blank">Terms &amp; Privacy Policy</a> *</span>
          </label>
          <label class="check">
            <input type="checkbox" [checked]="marketing()" (change)="marketing.set($any($event.target).checked)" />
            <span>Send me product news and tips</span>
          </label>

          @if (error()) { <p class="err" role="alert">{{ error() }}</p> }

          <div class="actions">
            <button class="ghost" (click)="skip()" [disabled]="!agreed() || busy()">Skip for now</button>
            <button class="cta" (click)="finish()" [disabled]="!canFinish() || busy()">
              {{ busy() ? 'Saving…' : 'Finish' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .overlay { position: fixed; inset: 0; z-index: 90; background: rgba(0,0,0,.5);
        display: grid; place-items: center; padding: 16px; overflow: auto; }
      .sheet { width: 100%; max-width: 460px; background: var(--surface,#fff); color: var(--text,#111827);
        border: 1px solid var(--border,#e5e7eb); border-radius: 18px; padding: 22px 20px;
        box-shadow: 0 24px 60px rgba(0,0,0,.3); }
      h2 { margin: 0 0 4px; font-size: 22px; }
      .sub { margin: 0 0 14px; color: var(--muted,#6b7280); font-size: 13px; }
      .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      label { display: grid; gap: 4px; font-size: 12px; color: var(--muted,#6b7280); }
      input[type=text], input, input[type=tel] { padding: 9px 10px; border: 1px solid var(--border,#d1d5db);
        border-radius: 9px; font: inherit; background: var(--surface,#fff); color: inherit; }
      .block { margin-top: 14px; }
      .lbl { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
      .chips { display: flex; flex-wrap: wrap; gap: 8px; }
      .chip { padding: 7px 12px; border: 1px solid var(--border,#d1d5db); border-radius: 999px;
        background: var(--surface,#fff); color: inherit; font-size: 13px; cursor: pointer; }
      .chip.on { background: var(--accent,#2563eb); border-color: var(--accent,#2563eb); color: #fff; }
      .check { display: flex; flex-direction: row; align-items: center; gap: 8px; margin-top: 14px;
        font-size: 13px; color: var(--text,#111827); }
      .check.required { font-weight: 600; }
      .check input { width: auto; }
      .err { color: #b91c1c; font-size: 13px; margin: 10px 0 0; }
      .actions { display: flex; justify-content: space-between; gap: 10px; margin-top: 18px; }
      .cta { background: var(--accent,#2563eb); color: #fff; border: none; border-radius: 11px;
        padding: 11px 20px; font-weight: 700; cursor: pointer; }
      .cta:disabled, .ghost:disabled { opacity: .5; cursor: default; }
      .ghost { background: none; border: none; color: var(--muted,#6b7280); cursor: pointer; font-size: 13px; }
    `,
  ],
})
export class Onboarding {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly entitlement = inject(EntitlementService);
  private readonly profile = inject(ProfileService);

  readonly firstName = signal('');
  readonly lastName = signal('');
  readonly displayName = signal('');
  readonly phone = signal('');
  readonly vehicles = signal<Set<string>>(new Set());
  readonly vehicleTypes = signal<ProfileResponse['available_vehicle_types']>([]);
  readonly questions = signal<SurveyQuestionModel[]>([]);
  private readonly answers = signal<Record<string, string | string[]>>({});
  readonly agreed = signal(false);
  readonly marketing = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  private readonly dismissed = signal(false);
  private loaded = false;

  /** Show once signed in with a real account and the server says not onboarded. */
  readonly visible = computed(
    () => this.auth.hasRealAccount() && this.entitlement.onboarded() === false && !this.dismissed(),
  );

  readonly canFinish = computed(
    () => this.agreed() && this.firstName().trim().length > 0 && this.lastName().trim().length > 0,
  );

  constructor() {
    // Keep /v1/me fresh once a real account appears (post magic-link redirect).
    effect(() => {
      if (this.auth.hasRealAccount() && this.entitlement.onboarded() === null) {
        void this.entitlement.refresh();
      }
    });
    // Load the form data the first time the modal becomes visible.
    effect(() => {
      if (this.visible() && !this.loaded) {
        this.loaded = true;
        void this.load();
      }
    });
  }

  private async load(): Promise<void> {
    try {
      const [profile, survey] = await Promise.all([
        this.api.getProfile(),
        this.api.getSurveyQuestions(),
      ]);
      this.vehicleTypes.set(profile.available_vehicle_types);
      this.questions.set(survey.questions);
      if (profile.first_name) this.firstName.set(profile.first_name);
      if (profile.last_name) this.lastName.set(profile.last_name);
    } catch {
      /* keep the form usable even if prefill fails */
    }
  }

  toggleVehicle(code: string): void {
    const next = new Set(this.vehicles());
    next.has(code) ? next.delete(code) : next.add(code);
    this.vehicles.set(next);
  }

  isChosen(q: SurveyQuestionModel, value: string): boolean {
    const a = this.answers()[q.key];
    return q.type === 'multi' ? Array.isArray(a) && a.includes(value) : a === value;
  }

  choose(q: SurveyQuestionModel, value: string): void {
    const map = { ...this.answers() };
    if (q.type === 'multi') {
      const cur = new Set(Array.isArray(map[q.key]) ? (map[q.key] as string[]) : []);
      cur.has(value) ? cur.delete(value) : cur.add(value);
      map[q.key] = [...cur];
    } else {
      map[q.key] = map[q.key] === value ? '' : value; // toggle off if re-tapped
    }
    this.answers.set(map);
  }

  private consents(): ConsentInput[] {
    return [
      { consent_type: 'tos', granted: this.agreed() },
      { consent_type: 'privacy', granted: this.agreed() },
      { consent_type: 'marketing', granted: this.marketing() },
    ];
  }

  private surveyPayload(): Record<string, string | string[]> {
    const out: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(this.answers())) {
      if (Array.isArray(v) ? v.length : v) out[k] = v;
    }
    return out;
  }

  async finish(): Promise<void> {
    await this.submit({
      first_name: this.firstName().trim(),
      last_name: this.lastName().trim(),
      display_name: this.displayName().trim() || null,
      phone: this.phone().trim() || null,
      vehicles: [...this.vehicles()],
      survey: this.surveyPayload(),
      consents: this.consents(),
    });
  }

  async skip(): Promise<void> {
    await this.submit({ consents: this.consents() });
  }

  private async submit(body: Parameters<ApiService['submitOnboarding']>[0]): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.api.submitOnboarding(body);
      await this.entitlement.refresh(); // /v1/me.onboarded flips true -> modal hides
      void this.profile.refresh(); // header identity chip picks up the just-entered name
      this.dismissed.set(true);
    } catch (e) {
      this.error.set((e as Error).message ?? 'Could not save. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }
}
