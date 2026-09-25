import { describe, expect, it } from 'vitest';
import { egyptMobileSchema } from './common.js';
import { normalizeEgyptMobile, normalizeEgyptPhone, toWaMeNumber, toWesternDigits } from './phone.js';

describe('normalizeEgyptMobile', () => {
  it.each([
    ['01012345678', '+201012345678'],
    ['011 2345 6789', '+201123456789'],
    ['+20 122-345-6789', '+201223456789'],
    ['00201512345678', '+201512345678'],
    ['201012345678', '+201012345678'],
    ['٠١٠١٢٣٤٥٦٧٨', '+201012345678'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeEgyptMobile(input)).toBe(expected);
  });

  it.each(['0101234567', '01312345678', '+441012345678', 'abc', '', '0223456789'])(
    'rejects %s',
    (input) => {
      expect(normalizeEgyptMobile(input)).toBeNull();
    },
  );
});

describe('normalizeEgyptPhone', () => {
  it('accepts Cairo landlines', () => {
    expect(normalizeEgyptPhone('02 2345 6789')).toBe('+20223456789');
  });
  it('accepts Alexandria landlines', () => {
    expect(normalizeEgyptPhone('03 4567890')).toBe('+2034567890');
  });
  it('accepts mobiles', () => {
    expect(normalizeEgyptPhone('01012345678')).toBe('+201012345678');
  });
});

describe('helpers', () => {
  it('converts Persian and Arabic-Indic digits', () => {
    expect(toWesternDigits('۰۱٢')).toBe('012');
  });
  it('strips + for wa.me', () => {
    expect(toWaMeNumber('+201012345678')).toBe('201012345678');
  });
  it('schema transforms to E.164', () => {
    expect(egyptMobileSchema.parse(' 01012345678 ')).toBe('+201012345678');
    expect(egyptMobileSchema.safeParse('123').success).toBe(false);
  });
});
