type ColorKey =
  | 'brandPrimary'
  | 'brandPressed'
  | 'brandSubtle'
  | 'accentFeatured'
  | 'accentOnFeatured'
  | 'textPrimary'
  | 'textSecondary'
  | 'borderDefault'
  | 'surfacePage'
  | 'surfaceCard'
  | 'statusAvailable'
  | 'statusStale'
  | 'statusDanger'
  | 'statusInfo';

interface TypeStyle {
  fontSize: number;
  lineHeight: number;
  fontWeight: string;
  letterSpacing?: number;
  fontVariant?: string[];
  lineHeightAr?: number;
}

export declare const theme: {
  colors: { light: Record<ColorKey, string>; dark: Record<ColorKey, string> };
  space: Record<'0' | '1' | '2' | '3' | '4' | '5' | '6' | '8' | '10' | '12' | '16', number>;
  radius: Record<'sm' | 'md' | 'lg' | 'full', number>;
  zIndex: Record<'sticky' | 'header' | 'sheet' | 'modal' | 'toast', number>;
  duration: Record<'fast' | 'base' | 'slow', number>;
  type: Record<'display' | 'h1' | 'h2' | 'price' | 'body' | 'caption' | 'label', TypeStyle>;
  fontFamily: { uiAr: string; uiEn: string; display: string };
  iconStroke: number;
  touchTarget: { ios: number; android: number };
};
