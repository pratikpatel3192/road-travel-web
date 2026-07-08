import { Component, OnInit, computed, inject, signal } from '@angular/core';
import type { ProfileResponse, SurveyQuestionModel } from '@road-travel/sdk';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';

/**
 * Profile section of Settings (F-003): edit name/display/phone, vehicles, marketing consent, and
 * finish a skipped survey. Reuses PUT /v1/me/profile + the survey endpoints. Shown only when signed
 * in with a real account (anonymous users have nothing to edit yet).
 */
@Component({
  selector: 'app-profile-settings',
  template: `
    @if (auth.hasRealAccount()) {
      <section class="card">
        <h2>Profile</h2>
        @if (loaded()) {
          <div class="grid2">
            <label>First name
              <input [value]="firstName()" (input)="firstName.set($any($event.target).value)" />
            </label>
            <label>Last name
              <input [value]="lastName()" (input)="lastName.set($any($event.target).value)" />
            </label>
            <label>Display name
              <input [value]="displayName()" (input)="displayName.set($any($event.target).value)" />
            </label>
            <label>Phone
              <input type="tel" [value]="phone()" (input)="phone.set($any($event.target).value)" />
            </label>
          </div>

          <span class="lbl">Vehicles</span>
          <div class="chips">
            @for (v of vehicleTypes(); track v.code) {
              <button type="button" class="chip" [class.on]="vehicles().has(v.code)" (click)="toggleVehicle(v.code)">
                {{ v.label }}
              </button>
            }
          </div>

          @for (q of questions(); track q.key) {
            <span class="lbl">{{ q.prompt }}</span>
            <div class="chips">
              @for (o of q.options; track o.value) {
                <button type="button" class="chip" [class.on]="isChosen(q, o.value)" (click)="choose(q, o.value)">
                  {{ o.label }}
                </button>
              }
            </div>
          }

          <label class="check">
            <input type="checkbox" [checked]="marketing()" (change)="marketing.set($any($event.target).checked)" />
            <span>Send me product news and tips</span>
          </label>

          @if (message()) { <p class="msg" [class.err]="isError()">{{ message() }}</p> }
          <button class="save" (click)="save()" [disabled]="busy()">
            {{ busy() ? 'Saving…' : 'Save profile' }}
          </button>
        } @else {
          <p class="muted">Loading…</p>
        }
      </section>
    }
  `,
  styles: [
    `
      .card { background: var(--surface,#fff); border: 1px solid var(--border,#e5e7eb);
        border-radius: var(--radius,14px); padding: 16px; margin-bottom: 14px; }
      h2 { font-size: 15px; margin: 0 0 12px; }
      .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      label { display: grid; gap: 4px; font-size: 12px; color: var(--muted,#6b7280); }
      input { padding: 9px 10px; border: 1px solid var(--border,#d1d5db); border-radius: 9px;
        font: inherit; background: var(--surface,#fff); color: var(--text,#111827); }
      .lbl { display: block; font-size: 13px; font-weight: 600; margin: 14px 0 6px; }
      .chips { display: flex; flex-wrap: wrap; gap: 8px; }
      .chip { padding: 7px 12px; border: 1px solid var(--border,#d1d5db); border-radius: 999px;
        background: var(--surface,#fff); color: inherit; font-size: 13px; cursor: pointer; }
      .chip.on { background: var(--accent,#2563eb); border-color: var(--accent,#2563eb); color: #fff; }
      .check { display: flex; align-items: center; gap: 8px; margin-top: 14px; font-size: 13px; }
      .check input { width: auto; }
      .save { margin-top: 14px; background: var(--accent,#2563eb); color: #fff; border: none;
        border-radius: 10px; padding: 10px 18px; font-weight: 600; cursor: pointer; }
      .save:disabled { opacity: .6; }
      .msg { font-size: 13px; margin: 12px 0 0; color: var(--muted,#6b7280); }
      .msg.err { color: #b91c1c; }
      .muted { color: var(--muted,#6b7280); font-size: 13px; }
    `,
  ],
})
export class ProfileSettings implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);

  readonly firstName = signal('');
  readonly lastName = signal('');
  readonly displayName = signal('');
  readonly phone = signal('');
  readonly vehicles = signal<Set<string>>(new Set());
  readonly vehicleTypes = signal<ProfileResponse['available_vehicle_types']>([]);
  readonly questions = signal<SurveyQuestionModel[]>([]);
  private readonly answers = signal<Record<string, string | string[]>>({});
  readonly marketing = signal(false);
  readonly loaded = signal(false);
  readonly busy = signal(false);
  readonly message = signal<string | null>(null);
  readonly isError = signal(false);

  async ngOnInit(): Promise<void> {
    if (!this.auth.hasRealAccount()) return;
    try {
      const [profile, survey] = await Promise.all([
        this.api.getProfile(),
        this.api.getSurveyQuestions(),
      ]);
      this.firstName.set(profile.first_name ?? '');
      this.lastName.set(profile.last_name ?? '');
      this.displayName.set(profile.display_name ?? '');
      this.phone.set(profile.phone ?? '');
      this.vehicles.set(new Set(profile.vehicles));
      this.vehicleTypes.set(profile.available_vehicle_types);
      this.marketing.set(profile.marketing_opt_in);
      this.questions.set(survey.questions);
      this.answers.set((profile.survey_answers ?? {}) as Record<string, string | string[]>);
      this.loaded.set(true);
    } catch {
      this.loaded.set(true);
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
      map[q.key] = map[q.key] === value ? '' : value;
    }
    this.answers.set(map);
  }

  async save(): Promise<void> {
    this.busy.set(true);
    this.message.set(null);
    try {
      // Profile + vehicles + marketing via the clean PUT (source=settings; no consent change).
      await this.api.updateProfile({
        first_name: this.firstName().trim() || null,
        last_name: this.lastName().trim() || null,
        display_name: this.displayName().trim() || null,
        phone: this.phone().trim() || null,
        vehicles: [...this.vehicles()],
        marketing_opt_in: this.marketing(),
      });
      // Survey answers have no PUT endpoint (only onboarding writes them), so finish/edit the survey
      // via the onboarding endpoint, re-affirming TOS+Privacy (append-only, harmless when re-recorded).
      const survey = this.surveyPayload();
      if (Object.keys(survey).length) {
        await this.api.submitOnboarding({
          survey,
          consents: [
            { consent_type: 'tos', granted: true },
            { consent_type: 'privacy', granted: true },
          ],
        });
      }
      this.message.set('Saved.');
      this.isError.set(false);
    } catch (e) {
      this.message.set((e as Error).message ?? 'Could not save.');
      this.isError.set(true);
    } finally {
      this.busy.set(false);
    }
  }

  private surveyPayload(): Record<string, string | string[]> {
    const out: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(this.answers())) {
      if (Array.isArray(v) ? v.length : v) out[k] = v;
    }
    return out;
  }
}
