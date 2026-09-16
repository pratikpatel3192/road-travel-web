import type { TourTarget } from './tour-script';

export interface TourRect {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The on-screen box of an element.
 *
 * `app-place-field` has no host style, so it is an inline element wrapping block children and its
 * own box is a zero-height line — measuring it alone would spotlight a hairline. An inline element
 * with no box of its own (or any `display: contents` one) is measured by what it contains instead.
 * An inline element that DOES have a box — the header's text links — is measured as itself.
 */
function boxOf(el: Element): TourRect | null {
  const style = getComputedStyle(el);
  if (style.display === 'none') return null;
  if (style.display === 'contents') return union([...el.children].map(boxOf));
  if (style.visibility === 'hidden') return null;
  const r = el.getBoundingClientRect();
  if (r.width > 0 && r.height > 0) {
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  }
  return style.display === 'inline' ? union([...el.children].map(boxOf)) : null;
}

function union(rects: readonly (TourRect | null)[]): TourRect | null {
  const shown = rects.filter((r): r is TourRect => r !== null);
  if (!shown.length) return null;
  const top = Math.min(...shown.map((r) => r.top));
  const left = Math.min(...shown.map((r) => r.left));
  const bottom = Math.max(...shown.map((r) => r.top + r.height));
  const right = Math.max(...shown.map((r) => r.left + r.width));
  return { top, left, width: right - left, height: bottom - top };
}

/** Every rendered, visible element carrying this target, in document order. */
export function tourTargetElements(target: TourTarget, root: ParentNode = document): Element[] {
  return [...root.querySelectorAll(`[data-tour="${target}"]`)].filter((el) => boxOf(el) !== null);
}

/**
 * Where the spotlight goes for a target, or null when nothing for it is on screen.
 *
 * `places` is two fields and is lit as one box around both. Every other target lights only the
 * FIRST visible match: My Trips exists both in the site header and as the planner's bookmark
 * button, and the header comes first in the document, so that is the one pointed at wherever it
 * is showing.
 */
export function tourTargetRect(target: TourTarget, root: ParentNode = document): TourRect | null {
  const els = tourTargetElements(target, root);
  if (!els.length) return null;
  return target === 'places' ? union(els.map(boxOf)) : boxOf(els[0]);
}

export function isTourTargetRendered(target: TourTarget): boolean {
  return tourTargetElements(target).length > 0;
}

/**
 * Some OTHER dialog is up — the stops editor, the paywall, onboarding, the force-update wall. The
 * tour never starts over one, and hides while one is open, because two modal layers fighting over
 * focus and Escape leave the traveller in neither.
 */
export function hasForeignModal(root: ParentNode = document): boolean {
  return [...root.querySelectorAll('[aria-modal="true"]')].some(
    (el) => !el.closest('app-tour-overlay'),
  );
}
