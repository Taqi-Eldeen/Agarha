import { formatEgp, interpolate, messages } from '@agarha/i18n';
import type { Landing } from '@agarha/schemas';
import type { Metadata } from 'next';
import { alternates } from './seo';

export function landingTitle(locale: 'ar' | 'en', d: Landing): string {
  const m = messages[locale];
  const city = locale === 'ar' ? d.city.nameAr : d.city.nameEn;
  if (d.area) return interpolate(m.web.landing.areaTitle, { area: locale === 'ar' ? d.area.nameAr : d.area.nameEn, city });
  if (d.type) return interpolate(m.web.landing.typeTitle, { type: m.ui.bodyTypes[d.type as keyof typeof m.ui.bodyTypes], city });
  return interpolate(m.web.landing.cityTitle, { city });
}

export function landingIntro(locale: 'ar' | 'en', d: Landing): string {
  const m = messages[locale].web.landing;
  return d.stats.n ? interpolate(m.intro, { count: d.stats.n, min: formatEgp(d.stats.min ?? 0, locale) }) : m.introEmpty;
}

export function landingMeta(locale: string, d: Landing, path: string): Metadata {
  const l = locale as 'ar' | 'en';
  return { title: `${landingTitle(l, d)} | ${l === 'ar' ? 'أجّرها' : 'Agarha'}`, description: landingIntro(l, d), alternates: alternates(locale, path), robots: d.stats.n ? undefined : { index: false } };
}
