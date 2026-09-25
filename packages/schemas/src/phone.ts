// Egyptian phone numbers. Everything is stored as E.164 (+20…).
// Accepted input: 01X…, +20…, 0020…, 20…, with spaces/dashes and Arabic-Indic digits.

const ARABIC_INDIC = /[٠-٩۰-۹]/g;

export function toWesternDigits(input: string): string {
  return input.replace(ARABIC_INDIC, (d) => {
    const code = d.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

/** Mobile prefixes: 010 Vodafone, 011 Etisalat/e&, 012 Orange, 015 WE. */
const MOBILE_NATIONAL = /^1[0125]\d{8}$/;
/** Landlines: area code (2 Cairo/Giza, 3 Alexandria, or 2-digit governorate code) + subscriber. */
const LANDLINE_NATIONAL = /^(?:2\d{8}|3\d{7}|[4-9]\d{8}|[4-9]\d{7})$/;

function toNational(input: string): string | null {
  let s = toWesternDigits(input).trim().replace(/[\s\-().]/g, '');
  if (s.startsWith('+')) s = s.slice(1);
  else if (s.startsWith('00')) s = s.slice(2);
  else if (s.startsWith('0')) return s.slice(1);
  if (!/^\d+$/.test(s)) return null;
  if (s.startsWith('20')) return s.slice(2);
  return null;
}

/** Returns the E.164 form of an Egyptian mobile number, or null if it isn't one. */
export function normalizeEgyptMobile(input: string): string | null {
  const national = toNational(input);
  return national && MOBILE_NATIONAL.test(national) ? `+20${national}` : null;
}

/** Returns the E.164 form of any Egyptian mobile or landline number, or null. */
export function normalizeEgyptPhone(input: string): string | null {
  const national = toNational(input);
  if (!national) return null;
  return MOBILE_NATIONAL.test(national) || LANDLINE_NATIONAL.test(national)
    ? `+20${national}`
    : null;
}

/** wa.me wants the number without "+". */
export function toWaMeNumber(e164: string): string {
  return e164.replace(/^\+/, '');
}
