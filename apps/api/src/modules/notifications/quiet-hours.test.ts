import { isQuietHours, msUntilQuietEnds } from './quiet-hours';

// Cairo is UTC+3 in summer (DST since 2023) and UTC+2 in winter.
describe('quiet hours (Africa/Cairo)', () => {
  it('is quiet at 23:00 Cairo in summer', () => {
    expect(isQuietHours(new Date('2026-07-01T20:00:00Z'))).toBe(true);
  });
  it('is not quiet at 12:00 Cairo', () => {
    expect(isQuietHours(new Date('2026-07-01T09:00:00Z'))).toBe(false);
  });
  it('ends at 09:00 Cairo', () => {
    expect(isQuietHours(new Date('2026-07-01T05:59:00Z'))).toBe(true); // 08:59
    expect(isQuietHours(new Date('2026-07-01T06:00:00Z'))).toBe(false); // 09:00
  });
  it('computes the wait until 09:00', () => {
    expect(msUntilQuietEnds(new Date('2026-07-01T20:00:00Z'))).toBe(10 * 3600 * 1000);
    expect(msUntilQuietEnds(new Date('2026-07-01T09:00:00Z'))).toBe(0);
  });
  it('handles winter offset', () => {
    expect(isQuietHours(new Date('2026-01-15T20:30:00Z'))).toBe(true); // 22:30 UTC+2
    expect(isQuietHours(new Date('2026-01-15T19:30:00Z'))).toBe(false); // 21:30
  });
});
