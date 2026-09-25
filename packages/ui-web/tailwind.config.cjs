/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('@agarha/tokens/tailwind-preset')],
  content: ['./src/**/*.{ts,tsx}', './.storybook/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
};
