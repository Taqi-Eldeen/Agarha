'use client';
import { interpolate, messages, type Messages } from '@agarha/i18n';
import type { Locale } from '@agarha/schemas';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Admin = Messages['admin'];
type Path<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Path<T[K], `${P}${K}.`>;
}[keyof T & string];

interface Ctx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: Path<Admin>, vars?: Record<string, string | number>) => string;
}
const I18n = createContext<Ctx | null>(null);

/** The console is a client-side app; locale lives in localStorage and switches <html lang/dir>. */
export function AdminI18n({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>('ar');
  useEffect(() => {
    const saved = localStorage.getItem('ag_admin_locale');
    if (saved === 'ar' || saved === 'en') setLocale(saved);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('ag_admin_locale', locale);
  }, [locale]);
  const t: Ctx['t'] = (key, vars) => {
    const v = key
      .split('.')
      .reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], messages[locale].admin);
    return typeof v === 'string' ? (vars ? interpolate(v, vars) : v) : key;
  };
  return <I18n.Provider value={{ locale, setLocale, t }}>{children}</I18n.Provider>;
}

export function useT() {
  const c = useContext(I18n);
  if (!c) throw new Error('AdminI18n missing');
  return c;
}
