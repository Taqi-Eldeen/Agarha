import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { authenticator } from 'otplib';

const SECRET = process.env.E2E_ADMIN_TOTP_SECRET ?? 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const SECTIONS = ['Dealers', 'Listings', 'Reports', 'Reviews', 'Catalog', 'Users', 'Plans', 'Audit log'];

test('ops signs in with TOTP, walks every section and moderates a listing', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ag_admin_locale', 'en'));
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill('admin@agarha.com');
  await page.getByRole('button', { name: 'Next' }).click();
  // A code is accepted once: start from a fresh 30s step so a code used by another suite can't collide.
  await page.waitForTimeout(31_000 - (Date.now() % 30_000));
  await page.locator('input[autocomplete="one-time-code"]').fill(authenticator.generate(SECRET));
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Live listings')).toBeVisible();

  for (const name of SECTIONS) {
    await page.getByRole('navigation').getByRole('link', { name, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations.map((v) => `${name}: ${v.id}`)).toEqual([]);
  }

  // Pre-moderation queue: approve whatever is waiting (the dealer E2E leaves one behind).
  await page.getByRole('navigation').getByRole('link', { name: 'Listings', exact: true }).click();
  const approve = page.getByRole('button', { name: 'Approve' });
  const before = await approve.count();
  if (before > 0) {
    await approve.first().click();
    await expect(approve).toHaveCount(before - 1);
  } else {
    await expect(page.getByText('No listings here.')).toBeVisible();
  }

  // Sign-out ends the session.
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/sign-in/);
});
