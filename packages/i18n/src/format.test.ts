import { describe, expect, it } from 'vitest';
import { messages } from './index.js';
import { dir, formatEgp, formatPhone, formatRelative, interpolate } from './format.js';

function keys(o: object, prefix = ''): string[] {
  return Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'string' ? [prefix + k] : keys(v as object, `${prefix}${k}.`),
  );
}

describe('catalogs', () => {
  it('ar and en have identical keys', () => {
    expect(keys(messages.en).sort()).toEqual(keys(messages.ar).sort());
  });
  it('placeholders match between languages', () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    const flat = (o: object, p = ''): [string, string][] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === 'string' ? [[p + k, v] as [string, string]] : flat(v as object, `${p}${k}.`),
      );
    const en = new Map(flat(messages.en));
    for (const [k, v] of flat(messages.ar)) expect(ph(en.get(k) ?? ''), k).toBe(ph(v));
  });
});

describe('formatters', () => {
  it('uses western digits in Arabic by default', () => {
    expect(formatEgp(1500, 'ar')).toBe('1,500 ج.م');
    expect(formatEgp(1500, 'en')).toBe('1,500 EGP');
  });
  it('formats relative time', () => {
    const now = new Date('2026-09-25T12:00:00Z');
    expect(formatRelative(new Date('2026-09-25T10:00:00Z'), 'en', now)).toBe('2 hours ago');
    expect(formatRelative(new Date('2026-09-24T12:00:00Z'), 'en', now)).toBe('yesterday');
    expect(formatRelative(new Date('2026-09-25T10:00:00Z'), 'ar', now)).toMatch(/2|ساعتين/);
  });
  it('formats phones with LTR isolation', () => {
    expect(formatPhone('+201012345678')).toBe('⁦010 1234 5678⁩');
  });
  it('interpolates', () => {
    expect(interpolate('Hi {name} {x}', { name: 'Mona' })).toBe('Hi Mona {x}');
  });
  it('knows direction', () => {
    expect(dir('ar')).toBe('rtl');
    expect(dir('en')).toBe('ltr');
  });
});
