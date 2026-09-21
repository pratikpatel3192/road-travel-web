import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The static landing page duplicates the capture logic of `AttributionService` and
 * `ReferralService`, because it is served by nginx outside Angular (ADR-0038) and cannot import
 * them. That duplication has now caused the same class of bug three times, each time because one
 * copy was updated and the other was not:
 *
 *  - the `rt_ref` slug regex had to be kept in step by hand;
 *  - `rt_utm_last` / `rt_utm_claimed` were added to the service and NOT to the landing page, so
 *    the claim could never fire for anyone arriving on `/` — the primary campaign entry point,
 *    and the rarer path was the only one that worked.
 *
 * These assertions are the contract between the two files. They are deliberately crude — presence
 * of a key, not behaviour — because the failure mode is always "the other copy does not know about
 * this key at all", and a crude check catches that on the first run.
 */
describe('landing.html capture contract', () => {
  const landing = readFileSync(join(process.cwd(), 'public/landing.html'), 'utf8');

  it.each(['rt_utm_q', 'rt_utm_last', 'rt_utm_claimed'])(
    'writes %s, which AttributionService reads',
    (key) => {
      expect(landing).toContain(key);
    },
  );

  it('writes rt_ref, which ReferralService reads', () => {
    expect(landing).toContain('rt_ref');
  });

  it('uses the same creator-slug pattern as ReferralService', () => {
    expect(landing).toContain('^[a-z0-9][a-z0-9-]{0,31}$');
  });

  it('caps the campaign queue, so a bot cannot grow it without bound', () => {
    expect(landing).toContain('slice(-10)');
  });

  it('sends only the landing PATH — a query string here is a place name (ADR-0037)', () => {
    expect(landing).toContain('location.pathname');
    expect(landing).not.toContain('landing_path: location.href');
  });
});
