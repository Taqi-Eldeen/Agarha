import { defineConfig, devices } from '@playwright/test';

/** Ops console E2E against a running API (seeded, APP_ENV=local for dev sign-in) + admin build. */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: process.env.ADMIN_URL ?? 'http://localhost:3001', trace: 'retain-on-failure', timezoneId: 'Africa/Cairo' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
});
