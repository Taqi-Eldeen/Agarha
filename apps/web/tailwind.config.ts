import type { Config } from 'tailwindcss';
import preset from '@agarha/tokens/tailwind-preset';

export default {
  presets: [preset],
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui-web/src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
} satisfies Config;
