import { describe, expect, it } from 'vitest';
import { freshnessOf, freshnessScore } from './freshness.js';

const now = new Date('2026-09-25T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

describe('freshnessOf', () => {
  it.each([
    [0, 'fresh'],
    [47.9, 'fresh'],
    [48, 'aging'],
    [7 * 24 - 1, 'aging'],
    [7 * 24, 'stale'],
    [14 * 24 - 1, 'stale'],
    [14 * 24, 'expired'],
  ] as const)('%s hours -> %s', (h, expected) => {
    expect(freshnessOf(hoursAgo(h), now)).toBe(expected);
  });
});

describe('freshnessScore', () => {
  it('is 1 when just confirmed and 0 at 14 days', () => {
    expect(freshnessScore(now, now)).toBe(1);
    expect(freshnessScore(hoursAgo(14 * 24), now)).toBe(0);
    expect(freshnessScore(hoursAgo(7 * 24), now)).toBeCloseTo(0.5);
  });
  it('clamps future timestamps', () => {
    expect(freshnessScore(hoursAgo(-5), now)).toBe(1);
  });
});
