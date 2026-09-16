/**
 * The first-run planner tour: every word it says, in one place.
 *
 * iOS ships the same tour, and the two must read identically — a traveller who meets it on the
 * phone and then on the web should not be taught the app twice in two voices. So the strings live
 * here and nowhere else, and `tour.spec.ts` asserts them character for character. Change one here
 * only together with the iOS copy.
 *
 * Straight apostrophes and em dashes are deliberate: they are what the shared script uses.
 */

/**
 * What a step points at. Each value is a `data-tour` attribute on the real element, so the tour
 * measures the planner as it is rendered rather than a picture of it.
 */
export type TourTarget = 'places' | 'stops' | 'plan' | 'my-trips' | 'account' | 'settings';

export interface TourStep {
  /** Stable id, for tests and analytics — never shown. */
  readonly id: string;
  readonly target: TourTarget;
  readonly title: string;
  readonly body: string;
}

/** Steps 1–4: the same for everyone. */
export const TOUR_COMMON_STEPS: readonly TourStep[] = [
  {
    id: 'places',
    target: 'places',
    title: 'Start here',
    body: "Type where you're leaving from and where you're going.",
  },
  {
    id: 'stops',
    target: 'stops',
    title: 'Add stops',
    body: 'Give a stop nights to make it a multi-day trip — every driving day gets its own forecast.',
  },
  {
    id: 'plan',
    target: 'plan',
    title: 'See the weather on your route',
    body: "Every stretch of the drive, at the hour you'll reach it.",
  },
  {
    id: 'my-trips',
    target: 'my-trips',
    title: 'Your trips, everywhere',
    body: 'Every trip you plan is saved here, on your phone and the web, and opens with the forecast you last saw.',
  },
];

/**
 * Step 5 for a guest. A guest who presses Get briefing is sent to sign in and then meets the trial
 * gate, so the last thing the tour says to them is the one step they cannot skip.
 */
export const TOUR_GUEST_FINAL: TourStep = {
  id: 'trial',
  target: 'account',
  title: 'Start your free trial',
  body: "Sign up to start your free 7-day trial — you'll need it to see forecasts.",
};

/** Step 5 for a signed-in account: where the tour itself can be found again. */
export const TOUR_SIGNED_IN_FINAL: TourStep = {
  id: 'settings',
  target: 'settings',
  title: 'Settings',
  body: 'Units, appearance, and this tour again.',
};

/** The whole script for this visitor. */
export function tourScript(signedIn: boolean): readonly TourStep[] {
  return [...TOUR_COMMON_STEPS, signedIn ? TOUR_SIGNED_IN_FINAL : TOUR_GUEST_FINAL];
}

export const TOUR_LABELS = {
  skip: 'Skip',
  back: 'Back',
  next: 'Next',
  done: 'Done',
  /** Settings' replay entry. */
  replay: 'Show app tour',
} as const;

/** "2 of 5" — the visible counter. Screen readers get "Step " in front of it. */
export function tourCountLabel(position: number, total: number): string {
  return `${position} of ${total}`;
}
