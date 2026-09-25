// NativeWind preset: the shared token preset + RN specifics. Type sizes come from the native token
// build in px (RN has no rem cascade and custom fonts carry their own weight per family).
const tokens = require('@agarha/tokens/tailwind-preset');
const { theme } = require('@agarha/tokens/native');

const px = (n) => `${n}px`;
const fontSize = Object.fromEntries(
  Object.entries(theme.type).map(([k, v]) => [
    k,
    [
      px(v.fontSize),
      {
        lineHeight: px(v.lineHeightAr ?? v.lineHeight),
        ...(v.letterSpacing ? { letterSpacing: px(v.letterSpacing) } : {}),
      },
    ],
  ]),
);

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [tokens, require('nativewind/preset')],
  theme: {
    extend: {
      fontSize,
      minHeight: { touch: px(theme.touchTarget.android) },
      minWidth: { touch: px(theme.touchTarget.android) },
      fontFamily: {
        ar: ['IBMPlexSansArabic_400Regular'],
        'ar-medium': ['IBMPlexSansArabic_500Medium'],
        'ar-semibold': ['IBMPlexSansArabic_600SemiBold'],
        en: ['IBMPlexSans_400Regular'],
        'en-medium': ['IBMPlexSans_500Medium'],
        'en-semibold': ['IBMPlexSans_600SemiBold'],
        display: ['Rubik_600SemiBold'],
      },
    },
  },
};
