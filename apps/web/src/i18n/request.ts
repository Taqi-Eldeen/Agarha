import { messages } from '@agarha/i18n';
import type { Locale } from '@agarha/schemas';
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: Locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: messages[locale] as unknown as Record<string, unknown>,
    timeZone: 'Africa/Cairo',
    // A5: western digits in both languages; formatting stays centralised in @agarha/i18n.
    formats: { number: { egp: { maximumFractionDigits: 0, numberingSystem: 'latn' } } },
  };
});
