/** The web app's release version, sent to /v1/config (ADR-0036). Bump alongside package.json
 * at release time; the server compares — the client never does version math. */
export const APP_VERSION = '3.0.0';

/** Pre-filled "Share feedback" mailto (settings + footer): the subject carries the version
 * context a report needs, so users never type it. Same inbox the support page links. */
export const FEEDBACK_MAILTO =
  'mailto:support@roadtravel.info' +
  `?subject=${encodeURIComponent(`Road Travel feedback (web ${APP_VERSION})`)}` +
  `&body=${encodeURIComponent(`\n\n—\nRoad Travel web ${APP_VERSION}`)}`;
