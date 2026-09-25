// All number/date/phone formatting goes through here so the digit policy (A5) changes in one place.
import type { Locale } from '@agarha/schemas';

export type DigitStyle = 'latn' | 'arab';

/** A5: Western digits (0–9) in both languages by default. */
export const DIGIT_STYLE: Record<Locale, DigitStyle> = { ar: 'latn', en: 'latn' };

export const TIME_ZONE = 'Africa/Cairo';

function tag(locale: Locale): string {
  const base = locale === 'ar' ? 'ar-EG' : 'en-EG';
  return `${base}-u-nu-${DIGIT_STYLE[locale]}`;
}

const cache = new Map<string, Intl.NumberFormat>();
function numberFormat(locale: Locale, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = locale + JSON.stringify(opts);
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(tag(locale), opts);
    cache.set(key, f);
  }
  return f;
}

export function formatNumber(value: number, locale: Locale): string {
  return numberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

/** EGP, whole pounds. "1,500 EGP" / "1,500 ج.م". Currency label follows the locale. */
export function formatEgp(amount: number, locale: Locale): string {
  const n = formatNumber(amount, locale);
  return locale === 'ar' ? `${n} ج.م` : `${n} EGP`;
}

export function formatDate(
  date: Date,
  locale: Locale,
  opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  return new Intl.DateTimeFormat(tag(locale), { timeZone: TIME_ZONE, ...opts }).format(date);
}

/** "2 hours ago" / "منذ ساعتين". */
export function formatRelative(date: Date, locale: Locale, now: Date = new Date()): string {
  const rtf = new Intl.RelativeTimeFormat(tag(locale), { numeric: 'auto' });
  const diffSec = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  return rtf.format(Math.round(diffSec / 86_400), 'day');
}

/**
 * Display an E.164 Egyptian number the way people write it: "010 1234 5678".
 * Wrapped in LTR isolation marks so it never mirrors inside Arabic text.
 */
export function formatPhone(e164: string): string {
  const national = e164.startsWith('+20') ? `0${e164.slice(3)}` : e164;
  const grouped =
    national.length === 11
      ? `${national.slice(0, 3)} ${national.slice(3, 7)} ${national.slice(7)}`
      : national;
  return `⁦${grouped}⁩`;
}

/** Tiny ICU-less interpolation for "{name}" placeholders. */
export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
}

export function dir(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}
