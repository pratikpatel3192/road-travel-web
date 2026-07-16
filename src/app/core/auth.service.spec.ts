import { isInactivityExpired } from './auth.service';

const DAY = 24 * 60 * 60 * 1000;

/** ADR-0025 §6: web sessions are dropped after 7 days of inactivity. */
describe('isInactivityExpired (7-day web inactivity rule)', () => {
  const now = 1_800_000_000_000;

  it('keeps a session used within the last 7 days', () => {
    expect(isInactivityExpired(now - 6 * DAY, now)).toBe(false);
    expect(isInactivityExpired(now - 7 * DAY, now)).toBe(false); // exactly 7d = still valid
  });

  it('expires a session idle for more than 7 days', () => {
    expect(isInactivityExpired(now - 7 * DAY - 1, now)).toBe(true);
    expect(isInactivityExpired(now - 30 * DAY, now)).toBe(true);
  });

  it('never expires when there is no prior stamp (first visit)', () => {
    expect(isInactivityExpired(0, now)).toBe(false);
  });
});
