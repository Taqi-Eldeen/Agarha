import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests for the web app's pure logic (SEO, URLs, landing copy, form validation).
// Browser flows live in e2e/ and run with Playwright, not here.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    env: {
      NEXT_PUBLIC_SITE_URL: 'https://agarha.test',
      NEXT_PUBLIC_API_URL: 'https://api.agarha.test',
    },
    coverage: { provider: 'v8', include: ['src/lib/**'], exclude: ['src/lib/**/*.test.ts'] },
  },
});
