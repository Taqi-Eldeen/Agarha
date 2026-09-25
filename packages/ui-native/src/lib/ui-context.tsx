import { dir as dirOf, formatEgp, formatRelative, interpolate, uiMessages, type Messages } from '@agarha/i18n';
import type { Locale } from '@agarha/schemas';
import { theme } from '@agarha/tokens/native';
import { vars } from 'nativewind';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { View } from 'react-native';

export type Scheme = 'light' | 'dark';
type Colors = (typeof theme.colors)['light'];

interface Ui {
  locale: Locale;
  dir: 'rtl' | 'ltr';
  scheme: Scheme;
  /** Hex colours for props that can't take a className (icons, ActivityIndicator, placeholders). */
  colors: Colors;
  t: Messages['ui'];
  f: (key: keyof Messages['ui'], vars: Record<string, string | number>) => string;
  egp: (n: number) => string;
  ago: (iso: string | Date) => string;
  /** Font class for the current locale and weight (Arabic uses IBM Plex Sans Arabic). */
  font: (weight?: 'regular' | 'medium' | 'semibold') => string;
}

const UiContext = createContext<Ui | null>(null);

const VAR: Record<keyof Colors, string> = {
  brandPrimary: '--ag-color-brand-primary',
  brandPressed: '--ag-color-brand-pressed',
  brandSubtle: '--ag-color-brand-subtle',
  accentFeatured: '--ag-color-accent-featured',
  accentOnFeatured: '--ag-color-accent-on-featured',
  textPrimary: '--ag-color-text-primary',
  textSecondary: '--ag-color-text-secondary',
  borderDefault: '--ag-color-border-default',
  surfacePage: '--ag-color-surface-page',
  surfaceCard: '--ag-color-surface-card',
  statusAvailable: '--ag-color-status-available',
  statusStale: '--ag-color-status-stale',
  statusDanger: '--ag-color-status-danger',
  statusInfo: '--ag-color-status-info',
};

/** "#0F6E68" → "15 110 104" (the shape the Tailwind preset's rgb(var(--x) / alpha) expects). */
export function hexToChannels(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** Token CSS variables for a scheme, applied at the root with NativeWind's vars(). */
export function themeVars(scheme: Scheme): Record<string, string> {
  const c = theme.colors[scheme];
  return Object.fromEntries((Object.keys(VAR) as (keyof Colors)[]).map((k) => [VAR[k], hexToChannels(c[k])]));
}

/** Wrap the app once: strings, formatters, RTL and the light/dark token variables. */
export function UiProvider({ locale, scheme = 'light', children }: { locale: Locale; scheme?: Scheme; children: ReactNode }) {
  const value = useMemo<Ui>(() => {
    const t = uiMessages[locale];
    const family = locale === 'ar' ? 'ar' : 'en';
    return {
      locale,
      dir: dirOf(locale),
      scheme,
      colors: theme.colors[scheme],
      t,
      f: (key, v) => interpolate(String(t[key]), v),
      egp: (n) => formatEgp(n, locale),
      ago: (d) => formatRelative(typeof d === 'string' ? new Date(d) : d, locale),
      font: (w = 'regular') => (w === 'regular' ? `font-${family}` : `font-${family}-${w}`),
    };
  }, [locale, scheme]);
  const style = useMemo(() => vars(themeVars(scheme)), [scheme]);
  return (
    <UiContext.Provider value={value}>
      <View style={[{ flex: 1, direction: value.dir }, style]}>{children}</View>
    </UiContext.Provider>
  );
}

export function useUi(): Ui {
  const ui = useContext(UiContext);
  if (!ui) throw new Error('Wrap the app in <UiProvider locale=...>');
  return ui;
}
