/** The web app's release version, sent to /v1/config (ADR-0036). Bump alongside package.json
 * at release time; the server compares — the client never does version math. */
export const APP_VERSION = '3.0.0';
