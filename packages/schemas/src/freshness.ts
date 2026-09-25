// Freshness rules (risk #1, stale availability).
//   < 48h        -> "fresh"  (green chip)
//   48h – 7 days -> "aging"  (amber chip)
//   7 – 14 days  -> "stale"  (no chip; "last confirmed" text only, lower ranking)
//   >= 14 days   -> "expired" (listing is auto-hidden by the hourly job)

const HOUR = 3_600_000;
export const FRESH_MAX_MS = 48 * HOUR;
export const AGING_MAX_MS = 7 * 24 * HOUR;
export const AUTO_HIDE_AFTER_MS = 14 * 24 * HOUR;

export type Freshness = 'fresh' | 'aging' | 'stale' | 'expired';

export function freshnessOf(lastConfirmedAt: Date, now: Date = new Date()): Freshness {
  const age = now.getTime() - lastConfirmedAt.getTime();
  if (age < FRESH_MAX_MS) return 'fresh';
  if (age < AGING_MAX_MS) return 'aging';
  if (age < AUTO_HIDE_AFTER_MS) return 'stale';
  return 'expired';
}

/** Ranking boost in [0, 1]; decays linearly to 0 at the auto-hide threshold. */
export function freshnessScore(lastConfirmedAt: Date, now: Date = new Date()): number {
  const age = Math.max(0, now.getTime() - lastConfirmedAt.getTime());
  return Math.max(0, 1 - age / AUTO_HIDE_AFTER_MS);
}
