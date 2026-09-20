import { Injectable } from '@angular/core';

/** One campaign arrival, as it waits in `localStorage` for the app to post it. */
export interface CampaignTouch {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  referrer?: string;
  landing_path?: string;
}

/**
 * ADR-0048: which campaign brought this visitor, captured from `?utm_*` and posted to the server.
 *
 * **Why a queue rather than the single stored value `rt_ref` uses.** A creator referral is
 * first-touch-and-final — one slug, decided once — so the client stores it and never looks again.
 * A campaign arrival is an event, and a visitor may arrive under several over weeks. The server
 * keeps the history and decides which one counts, so the client's job is only to make sure none is
 * lost on the way there.
 *
 * Losing them is the real risk, because of ADR-0038: the static landing page at `/` is where
 * campaign links actually land, it is served by nginx outside Angular, and it has **no Supabase
 * session**, so it cannot call an authenticated endpoint at all. It parks the arrival here instead,
 * and the Angular app drains the queue on its next bootstrap. Someone who visits three campaign
 * links over three weeks and only then opens the planner still reports three touches.
 *
 * The queue is capped and deduped against its own tail, so a reload loop or a bot parked on a
 * campaign link cannot grow it without bound — the same concern the server's unique index handles
 * on its side.
 */
@Injectable({ providedIn: 'root' })
export class AttributionService {
  private static readonly KEY = 'rt_utm_q';
  /** Small on purpose: this is a hand-off buffer, not a log. The server keeps the history. */
  private static readonly MAX = 10;

  /**
   * Record `?utm_*` from this URL, if it names a campaign. Returns whether anything was queued.
   *
   * Called on app bootstrap for people landing on `/plan?utm_source=…` directly; the landing page
   * runs an inline copy of the same logic for its own arrivals.
   */
  capture(search: string = window.location.search, referrer: string = document.referrer): boolean {
    const p = new URLSearchParams(search);
    const touch: CampaignTouch = {
      utm_source: p.get('utm_source') ?? undefined,
      utm_medium: p.get('utm_medium') ?? undefined,
      utm_campaign: p.get('utm_campaign') ?? undefined,
      utm_term: p.get('utm_term') ?? undefined,
      utm_content: p.get('utm_content') ?? undefined,
      referrer: referrer || undefined,
      // Path only. The server strips a query string regardless, but sending one at all would put
      // the user's typed destinations on the wire — `/plan?from=Chicago` is a place name
      // (ADR-0037), and the cheapest place to not send it is here.
      landing_path: window.location.pathname || undefined,
    };
    // Mirrors the server's `touches_not_empty` constraint: an arrival naming no source says only
    // "somebody arrived", which is what analytics is for.
    if (!touch.utm_source && !touch.utm_medium && !touch.utm_campaign) return false;
    return this.enqueue(touch);
  }

  /** Everything waiting to be posted, oldest first. */
  get pending(): CampaignTouch[] {
    try {
      const raw = localStorage.getItem(AttributionService.KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as CampaignTouch[]) : [];
    } catch {
      // Unavailable, or somebody hand-edited it into nonsense. Either way there is nothing to
      // send, and marketing data is never worth throwing on.
      return [];
    }
  }

  /**
   * Drop the touches that were posted successfully.
   *
   * Removes by identity from the front rather than clearing outright: a touch captured *while* the
   * drain was in flight must survive it, or a campaign arrival is lost to a race with itself.
   */
  clearSent(sent: CampaignTouch[]): void {
    if (!sent.length) return;
    const remaining = this.pending.slice(sent.length);
    this.write(remaining);
  }

  private enqueue(touch: CampaignTouch): boolean {
    const queue = this.pending;
    // A reload under the same campaign is not a new arrival. The server would collapse it anyway;
    // not sending it saves a request and keeps the queue meaningful.
    const last = queue[queue.length - 1];
    if (last && this.sameCampaign(last, touch)) return false;
    queue.push(touch);
    // Drop from the FRONT when full: if a visitor really has collected more than ten campaigns
    // without ever opening the app, the recent ones are the ones still worth reporting.
    this.write(queue.slice(-AttributionService.MAX));
    return true;
  }

  private sameCampaign(a: CampaignTouch, b: CampaignTouch): boolean {
    return (
      a.utm_source === b.utm_source &&
      a.utm_medium === b.utm_medium &&
      a.utm_campaign === b.utm_campaign &&
      a.utm_term === b.utm_term &&
      a.utm_content === b.utm_content
    );
  }

  private write(queue: CampaignTouch[]): void {
    try {
      localStorage.setItem(AttributionService.KEY, JSON.stringify(queue));
    } catch {
      /* private mode / storage blocked — the arrival is simply not captured */
    }
  }
}
