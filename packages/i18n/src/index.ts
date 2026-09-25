import type { Locale } from '@agarha/schemas';
import { ar, type Messages } from './messages/ar.js';
import { en } from './messages/en.js';

export const messages: Record<Locale, Messages> = { ar, en };
export type { Messages };
export * from './format.js';
