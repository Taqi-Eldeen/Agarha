import type { Locale } from '@agarha/schemas';
import { render, type RenderResult } from '@testing-library/react';
import axe from 'axe-core';
import type { ReactElement } from 'react';
import { UiProvider } from '../lib/ui-context';

export function renderUi(ui: ReactElement, locale: Locale = 'ar'): RenderResult {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  return render(ui, {
    wrapper: ({ children }) => <UiProvider locale={locale}>{children}</UiProvider>,
  });
}

/** Runs axe on a container (WCAG 2.2 A/AA rules; colour contrast is covered by the token tests). */
export async function axeViolations(container: Element) {
  const r = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

export const CARD = {
  id: '0b6c7f6e-8f3a-4a57-9a2f-5d7c1c9f2b11',
  slug: 'toyota-corolla-2024',
  photo: { url320: '/p-320.webp', url640: '/p-640.webp', blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj' },
  photoCount: 3,
  make: { ar: 'تويوتا', en: 'Toyota' },
  model: { ar: 'كورولا', en: 'Corolla' },
  bodyType: 'sedan' as const,
  year: 2024,
  transmission: 'automatic' as const,
  seats: 5,
  driverOption: 'self' as const,
  prices: { day: 1500, week: 9000, month: null, deposit: 5000 },
  requiredDocs: ['national_id' as const, 'egyptian_driving_licence' as const],
  minAge: 23,
  kmLimitPerDay: 200,
  airportPickup: false,
  lastConfirmedAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
  available: true,
  featured: true,
  dealer: {
    id: '1b6c7f6e-8f3a-4a57-9a2f-5d7c1c9f2b11',
    slug: 'nile',
    nameAr: 'النيل',
    nameEn: 'Nile Rentals',
    verified: true,
    whatsapp: '+201012345678',
    phone: '+201012345678',
  },
  area: { slug: 'nasr-city', ar: 'مدينة نصر', en: 'Nasr City' },
  city: { slug: 'cairo', ar: 'القاهرة', en: 'Cairo' },
  location: { lat: 30.05, lng: 31.33 },
};
