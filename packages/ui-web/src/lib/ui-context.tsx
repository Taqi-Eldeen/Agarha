'use client';
import {
  dir as dirOf,
  formatEgp,
  formatRelative,
  interpolate,
  uiMessages,
  type Messages,
} from '@agarha/i18n';
import type { Locale } from '@agarha/schemas';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

interface Ui {
  locale: Locale;
  dir: 'rtl' | 'ltr';
  t: Messages['ui'];
  /** Interpolated string from the ui catalog. */
  f: (key: keyof Messages['ui'], vars: Record<string, string | number>) => string;
  egp: (n: number) => string;
  ago: (iso: string | Date) => string;
}

const UiContext = createContext<Ui | null>(null);

/** Apps wrap the tree once; components read strings and formatters from here (never hardcoded). */
export function UiProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<Ui>(() => {
    const t = uiMessages[locale];
    return {
      locale,
      dir: dirOf(locale),
      t,
      f: (key, vars) => interpolate(String(t[key]), vars),
      egp: (n) => formatEgp(n, locale),
      ago: (d) => formatRelative(typeof d === 'string' ? new Date(d) : d, locale),
    };
  }, [locale]);
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): Ui {
  const ui = useContext(UiContext);
  if (!ui) throw new Error('Wrap the app in <UiProvider locale=...>');
  return ui;
}
