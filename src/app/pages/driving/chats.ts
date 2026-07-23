import { Component, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  ConversationModel,
  DriveModel,
  FriendshipModel,
  MessageModel,
} from '@road-travel/sdk';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { SettingsService } from '../../core/settings.service';
import { formatDistance } from '../plan/severity';

/**
 * F-007 P3 M8 chats (ADR-0034): history and sends ride REST; each open conversation joins its
 * private Realtime topic (`chat:{id}`) and treats any broadcast as a "refresh now" signal — the
 * thread re-reads history, so every rendered message is the server-sanitized authoritative copy.
 * DMs die with the friendship (server-omitted); groups need 2+ accepted friends.
 */
@Component({
  selector: 'app-chats',
  imports: [RouterLink],
  template: `
    <div class="page">
      <header class="top">
        <a routerLink="/driving" class="back" aria-label="Back">←</a>
        <h1>Chats</h1>
        <button class="act new" (click)="showNewGroup.set(!showNewGroup())">
          {{ showNewGroup() ? 'Close' : 'New group' }}
        </button>
      </header>

      @if (error(); as e) {
        <p class="error">{{ e }}</p>
      }

      @if (showNewGroup()) {
        <div class="group-form">
          <input
            type="text"
            placeholder="Group name (optional)"
            [value]="groupTitle()"
            (input)="groupTitle.set($any($event.target).value)"
          />
          @for (f of friends(); track f.id) {
            <label class="pick">
              <input
                type="checkbox"
                [checked]="selected().has(f.id)"
                (change)="toggle(f.id)"
              />
              {{ friendName(f) }}
            </label>
          } @empty {
            <p class="empty">You need at least two accepted friends to start a group.</p>
          }
          <button
            class="send"
            [disabled]="busy() || selected().size < 2"
            (click)="createGroup()"
          >
            {{ busy() ? 'Creating…' : 'Create group' }}
          </button>
        </div>
      }

      @for (c of conversations(); track c.id) {
        <div class="convo">
          <button class="open" (click)="toggleConversation(c)">
            <span class="names">{{ name(c) }}</span>
            <span class="sub">{{ open()?.id === c.id ? 'hide' : preview(c) }}</span>
          </button>
          @if (open()?.id === c.id) {
            <div class="thread" id="thread">
              @for (m of oldestFirst(); track m.id) {
                <div class="msg" [class.mine]="m.mine">
                  @if (c.kind === 'group' && !m.mine) {
                    <span class="who">{{ senderName(m) }}</span>
                  }
                  @if (m.drive; as d) {
                    <span class="drive">🚗 {{ driveTitle(d) }} · {{ dist(d.distance_meters) }}</span>
                  }
                  <span class="body">{{ m.body }}</span>
                  <span class="meta">
                    {{ when(m.created_at) }}
                    @if (!m.mine) {
                      <button class="report" (click)="report(c, m)" title="Report this message">
                        report
                      </button>
                    }
                  </span>
                </div>
              } @empty {
                <p class="empty">{{ threadLoading() ? 'Loading…' : 'No messages yet — say hi!' }}</p>
              }
              <form class="composer" (submit)="send($event, c)">
                @if (drives().length) {
                  <select [value]="attachedDriveId() ?? ''"
                          (change)="attachedDriveId.set($any($event.target).value || null)">
                    <option value="">No drive attached</option>
                    @for (d of drives(); track d.id) {
                      <option [value]="d.id">🚗 {{ driveTitle(d) }}</option>
                    }
                  </select>
                }
                <div class="line">
                  <input
                    type="text"
                    placeholder="Message"
                    maxlength="2000"
                    [value]="draft()"
                    (input)="draft.set($any($event.target).value)"
                  />
                  <button type="submit" class="send" [disabled]="sending() || !canSend()">
                    Send
                  </button>
                </div>
              </form>
            </div>
          }
        </div>
      } @empty {
        @if (!loading()) {
          <p class="empty">No chats yet — open one from a friend on the Driving page.</p>
        }
      }
    </div>
  `,
  styles: [
    `
      .page {
        max-width: 560px;
        margin: 0 auto;
        padding: 18px 16px 64px;
      }
      .top {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }
      .back {
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        border: 1px solid var(--border);
        background: var(--surface);
        color: var(--text);
        font-size: 18px;
      }
      .back:hover {
        text-decoration: none;
      }
      h1 {
        font-size: 22px;
        margin: 0;
        flex: 1;
      }
      .convo {
        margin-bottom: 8px;
      }
      .open {
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        padding: 12px 14px;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface);
        color: var(--text);
        font: inherit;
        text-align: left;
        cursor: pointer;
      }
      .open:hover {
        border-color: var(--accent);
      }
      .names {
        font-weight: 600;
        font-size: 15px;
      }
      .sub {
        color: var(--muted);
        font-size: 13px;
        max-width: 55%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .thread {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px 6px 0;
        max-height: 420px;
        overflow-y: auto;
      }
      .msg {
        display: flex;
        flex-direction: column;
        gap: 2px;
        align-self: flex-start;
        max-width: 82%;
        padding: 8px 12px;
        border-radius: 14px;
        background: var(--surface);
        border: 1px solid var(--border);
      }
      .msg.mine {
        align-self: flex-end;
        background: var(--accent);
        color: var(--accent-contrast);
        border-color: var(--accent);
      }
      .who {
        font-size: 11px;
        color: var(--muted);
        font-weight: 600;
      }
      .drive {
        font-size: 12px;
        font-weight: 600;
      }
      .body {
        font-size: 14px;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .meta {
        font-size: 11px;
        opacity: 0.7;
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .report {
        border: none;
        background: none;
        color: inherit;
        font-size: 11px;
        text-decoration: underline;
        cursor: pointer;
        padding: 0;
      }
      .composer {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px 6px 2px;
        position: sticky;
        bottom: 0;
        background: var(--bg, transparent);
      }
      .composer select,
      .composer input {
        padding: 9px 12px;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface);
        color: var(--text);
        font: inherit;
        font-size: 14px;
      }
      .line {
        display: flex;
        gap: 8px;
      }
      .line input {
        flex: 1;
      }
      .send {
        padding: 9px 14px;
        border: none;
        border-radius: var(--radius);
        background: var(--accent);
        color: var(--accent-contrast);
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }
      .send:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .empty {
        color: var(--muted);
        font-size: 14px;
        padding: 4px 2px 8px;
      }
      .error {
        color: var(--sev-severe);
        font-size: 13px;
        margin: 0 2px 6px;
      }
      .act {
        padding: 6px 10px;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface);
        color: var(--text);
        font: inherit;
        font-size: 13px;
        cursor: pointer;
      }
      .act:hover {
        border-color: var(--accent);
      }
      .group-form {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px 14px;
        margin-bottom: 10px;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface);
      }
      .group-form input[type='text'] {
        padding: 9px 12px;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface);
        color: var(--text);
        font: inherit;
      }
      .pick {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
      }
    `,
  ],
})
export class Chats implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly settings = inject(SettingsService);
  private readonly route = inject(ActivatedRoute);

  readonly conversations = signal<ConversationModel[]>([]);
  readonly friends = signal<FriendshipModel[]>([]);
  readonly drives = signal<DriveModel[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly open = signal<ConversationModel | null>(null);
  readonly messages = signal<MessageModel[]>([]);
  readonly threadLoading = signal(false);
  readonly draft = signal('');
  readonly attachedDriveId = signal<string | null>(null);
  readonly sending = signal(false);

  readonly showNewGroup = signal(false);
  readonly groupTitle = signal('');
  readonly selected = signal<Set<string>>(new Set());
  readonly busy = signal(false);

  private channel: RealtimeChannel | null = null;

  constructor() {
    void this.refresh().then(() => {
      // Deep link from the Driving page: /chats?open=<conversation_id>.
      const openId = this.route.snapshot.queryParamMap.get('open');
      const target = openId ? this.conversations().find((c) => c.id === openId) : null;
      if (target) this.toggleConversation(target);
    });
  }

  ngOnDestroy(): void {
    this.leave();
  }

  private async refresh(): Promise<void> {
    try {
      const [convos, graph, drives] = await Promise.all([
        this.api.listConversations(),
        this.api.listFriends(),
        this.api.listDrives(),
      ]);
      this.conversations.set(convos.conversations);
      this.friends.set(graph.friends ?? []);
      this.drives.set(drives.drives);
    } catch {
      this.error.set('Couldn’t load your chats.');
    } finally {
      this.loading.set(false);
    }
  }

  // --- thread ------------------------------------------------------------------------------------

  toggleConversation(c: ConversationModel): void {
    if (this.open()?.id === c.id) {
      this.leave();
      this.open.set(null);
      return;
    }
    this.leave();
    this.open.set(c);
    this.messages.set([]);
    this.draft.set('');
    this.attachedDriveId.set(null);
    void this.loadMessages(c);
    // ADR-0034: the broadcast is a delivery signal only — re-read history on every event.
    this.channel = this.auth.channel(c.topic);
    this.channel
      ?.on('broadcast', { event: 'message' }, () => void this.loadMessages(c))
      .subscribe();
  }

  private leave(): void {
    void this.channel?.unsubscribe();
    this.channel = null;
  }

  private async loadMessages(c: ConversationModel): Promise<void> {
    this.threadLoading.set(true);
    try {
      const r = await this.api.listMessages(c.id);
      if (this.open()?.id === c.id) {
        this.messages.set(r.messages);
        this.scrollThread();
      }
    } catch {
      this.error.set('Couldn’t load that conversation.');
    } finally {
      this.threadLoading.set(false);
    }
  }

  private scrollThread(): void {
    requestAnimationFrame(() => {
      const el = document.getElementById('thread');
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  canSend(): boolean {
    return !!this.draft().trim() || !!this.attachedDriveId();
  }

  send(event: Event, c: ConversationModel): void {
    event.preventDefault();
    if (!this.canSend() || this.sending()) return;
    // A drive can go alone; the server requires a non-empty body, so default a caption.
    const body = this.draft().trim() || 'Shared a drive';
    this.sending.set(true);
    this.error.set(null);
    void this.api
      .sendMessage(c.id, body, this.attachedDriveId())
      .then(() => {
        this.draft.set('');
        this.attachedDriveId.set(null);
        return this.loadMessages(c);
      })
      .catch(() => {
        // 429 (rate limit) or a dead DM — both read the same to the sender.
        this.error.set('Couldn’t send — wait a moment and try again.');
      })
      .finally(() => this.sending.set(false));
  }

  report(c: ConversationModel, m: MessageModel): void {
    void this.api.reportMessage(c.id, m.id).then(() => {
      this.error.set('Reported. Thanks — we log every report.');
    });
  }

  // --- group creation ----------------------------------------------------------------------------

  toggle(friendshipId: string): void {
    const next = new Set(this.selected());
    if (next.has(friendshipId)) next.delete(friendshipId);
    else next.add(friendshipId);
    this.selected.set(next);
  }

  createGroup(): void {
    if (this.selected().size < 2 || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    void this.api
      .createGroup([...this.selected()], this.groupTitle().trim() || null)
      .then(async (convo) => {
        this.showNewGroup.set(false);
        this.groupTitle.set('');
        this.selected.set(new Set());
        await this.refresh();
        this.toggleConversation(convo);
      })
      .catch(() => this.error.set('Couldn’t create the group — try again.'))
      .finally(() => this.busy.set(false));
  }

  // --- formatting --------------------------------------------------------------------------------

  oldestFirst(): MessageModel[] {
    // Server order is newest-first; a thread reads oldest-first.
    return [...this.messages()].reverse();
  }

  name(c: ConversationModel): string {
    if (c.title) return c.title;
    const others = (c.members ?? []).map((m) => m.display_name || m.email || 'Friend');
    return others.length ? others.join(', ') : 'Chat';
  }

  preview(c: ConversationModel): string {
    const last = c.last_message;
    if (!last) return 'No messages yet';
    const prefix = last.mine ? 'You: ' : '';
    return prefix + (last.body || 'shared a drive');
  }

  senderName(m: MessageModel): string {
    return m.sender ? m.sender.display_name || m.sender.email || 'Friend' : 'Deleted account';
  }

  friendName(f: FriendshipModel): string {
    return f.friend.display_name || f.friend.email || 'Friend';
  }

  driveTitle(d: { title?: string | null; start_place?: string | null; end_place?: string | null }): string {
    if (d.title) return d.title;
    const from = d.start_place ?? 'Drive';
    return d.end_place ? `${from} → ${d.end_place}` : from;
  }

  dist(m: number): string {
    return formatDistance(m, this.settings.units());
  }

  when(iso: string): string {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  }
}
