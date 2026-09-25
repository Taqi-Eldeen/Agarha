import { describe, expect, it } from 'vitest';
import { normalizeArabic } from './arabic.js';

describe('normalizeArabic', () => {
  it.each([
    ['أحمد', 'احمد'],
    ['إسكندرية', 'اسكندريه'],
    ['مدينة نصر', 'مدينه نصر'],
    ['مصطفى', 'مصطفي'],
    ['تويوتا  كورولا', 'تويوتا كورولا'],
    ['كَرِيم', 'كريم'],
    ['٢٠٢٤ Corolla', '2024 corolla'],
    ['القاهـــرة', 'القاهره'],
  ])('%s -> %s', (input, out) => expect(normalizeArabic(input)).toBe(out));
});
