import type { Locale } from '@agarha/schemas';
import { admin } from './messages/admin.js';
import { app } from './messages/app.js';
import { ar, type Messages as CoreMessages } from './messages/ar.js';
import { dealer } from './messages/dealer.js';
import { en } from './messages/en.js';
import { web } from './messages/web.js';

export type Messages = CoreMessages & {
  web: (typeof web)['en'];
  dealer: (typeof dealer)['en'];
  admin: (typeof admin)['en'];
  app: (typeof app)['en'];
};

export const messages: Record<Locale, Messages> = {
  ar: { ...ar, web: web.ar, dealer: dealer.ar, admin: admin.ar, app: app.ar },
  en: { ...en, web: web.en, dealer: dealer.en, admin: admin.en, app: app.en },
};
export * from './format.js';

/** Only the component-library strings (what @agarha/ui-web needs on the client). */
export const uiMessages: Record<Locale, CoreMessages['ui']> = { ar: ar.ui, en: en.ui };
export * from './legal.js';
