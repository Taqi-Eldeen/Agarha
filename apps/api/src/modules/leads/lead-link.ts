import { toWaMeNumber } from '@agarha/schemas';

export interface LeadLinkInput {
  channel: 'whatsapp' | 'call';
  locale: 'ar' | 'en';
  dealerWhatsapp: string;
  dealerPhone: string;
  carAr: string;
  carEn: string;
  year: number;
  refCode: string;
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
/** Only inside the prefilled Arabic WhatsApp message (a message to a person, not our UI) we use Arabic-Indic digits for the year. */
const toArabicDigits = (n: number) => String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)]!);

export function leadMessage(i: LeadLinkInput): string {
  return i.locale === 'ar'
    ? `مرحباً، أستفسر عن ${i.carAr} ${toArabicDigits(i.year)} على أجّرها (Ref ${i.refCode})`
    : `Hello, I'm asking about the ${i.carEn} ${i.year} on Agarha (Ref ${i.refCode})`;
}

/** wa.me deep link with the reference code, or tel: for calls. */
export function leadUrl(i: LeadLinkInput): string {
  if (i.channel === 'call') return `tel:${i.dealerPhone}`;
  return `https://wa.me/${toWaMeNumber(i.dealerWhatsapp)}?text=${encodeURIComponent(leadMessage(i))}`;
}
