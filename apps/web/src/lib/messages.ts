import type { AbstractIntlMessages } from 'next-intl';

export const PUBLIC_NAMESPACES = [
  'common',
  'price',
  'freshness',
  'safety',
  'auth',
  'ui',
  'errors',
  'web',
] as const;
export const DEALER_NAMESPACES = [...PUBLIC_NAMESPACES, 'dealer'] as const;

/** The subset of the catalogue that client components under a layout actually read. */
export function pickMessages(
  all: AbstractIntlMessages,
  namespaces: readonly string[],
): AbstractIntlMessages {
  return Object.fromEntries(namespaces.filter((n) => n in all).map((n) => [n, all[n]!]));
}
