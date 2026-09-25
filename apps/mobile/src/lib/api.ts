import { createApiClient } from '@agarha/api-client';
import type { Locale } from '@agarha/schemas';
import { env } from './env';
import { tokenStore } from './tokens';

let locale: Locale = 'ar';
export const setApiLocale = (l: Locale) => void (locale = l);

export const api = createApiClient({ baseUrl: env.apiUrl, scope: 'customer', tokens: tokenStore, locale: () => locale });
