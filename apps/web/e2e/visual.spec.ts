import { expect, test } from '@playwright/test';

// Key pages in ar/en × light/dark (section 10: visual regression). Dynamic bits are masked.
const PAGES = ['/', '/for-dealers', '/help'];

for (const locale of ['ar', 'en']) {
  for (const scheme of ['light', 'dark'] as const) {
    for (const path of PAGES) {
      test(`visual ${locale} ${scheme} ${path}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
        await page.goto(`/${locale}${path === '/' ? '' : path}`);
        await page.waitForLoadState('networkidle').catch(() => undefined);
        await expect(page).toHaveScreenshot(`${locale}-${scheme}${path.replace(/\//g, '_') || '_home'}.png`, { fullPage: false, mask: [page.getByRole('article'), page.locator('img')] });
      });
    }
  }
}
