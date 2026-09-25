import { messages } from '@agarha/i18n';
import type { Locale } from '@agarha/schemas';
import * as Localization from 'expo-localization';
import * as Updates from 'expo-updates';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { I18nManager } from 'react-native';
import { IntlProvider } from 'use-intl';
import { setApiLocale } from './api';
import { prefs } from './storage';

interface LocaleCtx {
  locale: Locale;
  setLocale: (l: Locale) => Promise<void>;
}
const Ctx = createContext<LocaleCtx | null>(null);

/** Device language decides the first run (Arabic unless the phone is in English); the choice is remembered. */
export function initialLocale(saved: Locale | null, deviceLanguage: string | null | undefined): Locale {
  if (saved) return saved;
  return deviceLanguage === 'en' ? 'en' : 'ar';
}

function applyDirection(l: Locale) {
  const rtl = l === 'ar';
  I18nManager.allowRTL(rtl);
  if (I18nManager.isRTL !== rtl) I18nManager.forceRTL(rtl);
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setState] = useState<Locale | null>(null);
  useEffect(() => {
    void prefs.get<Locale | null>('locale', null).then((saved) => {
      const l = initialLocale(saved, Localization.getLocales()[0]?.languageCode);
      setApiLocale(l);
      applyDirection(l);
      setState(l);
    });
  }, []);
  const setLocale = useCallback(async (l: Locale) => {
    await prefs.set('locale', l);
    setApiLocale(l);
    const flip = I18nManager.isRTL !== (l === 'ar');
    applyDirection(l);
    setState(l);
    // Layout already follows the UiProvider direction; a reload also flips native chrome (headers, gestures).
    if (flip) await Updates.reloadAsync().catch(() => undefined);
  }, []);
  const value = useMemo(() => (locale ? { locale, setLocale } : null), [locale, setLocale]);
  if (!value) return null; // splash screen stays up until the locale is known
  return (
    <Ctx.Provider value={value}>
      <IntlProvider locale={value.locale} messages={messages[value.locale]} timeZone="Africa/Cairo">
        {children}
      </IntlProvider>
    </Ctx.Provider>
  );
}

export function useLocale(): LocaleCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useLocale must be used inside <LocaleProvider>');
  return c;
}
