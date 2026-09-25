'use client';
import { createApiClient } from '@agarha/api-client';
import { env } from './env';

/** Browser client: httpOnly cookies (credentials: include), no tokens in JS. */
export function makeClient(scope: 'customer' | 'dealer', locale: () => 'ar' | 'en') {
  return createApiClient({ baseUrl: env.NEXT_PUBLIC_API_URL, scope, locale });
}
