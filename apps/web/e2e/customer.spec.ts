import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { API } from './helpers';

test.describe('customer: search → listing → contact', () => {
  test('finds a car, sees the facts and contacts the dealer on WhatsApp with a reference code', async ({ page, context }) => {
    await page.goto('/ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.getByRole('button', { name: 'دوّر', exact: true }).click();
    await expect(page).toHaveURL(/\/ar\/search\?city=cairo/);
    const first = page.getByRole('article').first();
    await expect(first).toBeVisible();
    await first.getByRole('link').first().click();
    await expect(page).toHaveURL(/\/ar\/cars\/[0-9a-f-]{36}-/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Facts before contact: deposit + requirements + the deposit safety notice.
    await expect(page.getByText('المطلوب منك')).toBeVisible();
    await expect(page.getByText('متدفعش أي تأمين قبل ما تشوف العربية').first()).toBeVisible();

    const popup = context.waitForEvent('page');
    await page.getByRole('button', { name: 'واتساب' }).first().click();
    const wa = await popup;
    await wa.waitForURL(/wa\.me|whatsapp/, { timeout: 15_000 }).catch(() => undefined);
    expect(decodeURIComponent(wa.url())).toMatch(/Ref AG-[2-9A-Z]{4}/);
  });

  test('filters, period toggle and empty state', async ({ page }) => {
    await page.goto('/en/search?city=cairo&priceMax=1');
    await expect(page.getByText('No cars match these filters')).toBeVisible();
    await page.getByRole('button', { name: 'Clear all' }).first().click();
    await expect(page.getByRole('article').first()).toBeVisible();
    await page.getByRole('button', { name: 'Per week' }).first().click();
    await expect(page).toHaveURL(/period=week/);
    await expect(page.getByText('/ week').first()).toBeVisible();
  });

  test('landing pages expose structured data and hreflang', async ({ page, request }) => {
    const res = await request.get(`${API}/v1/search?limit=1`);
    const card = ((await res.json()) as { items: { card: { id: string; slug: string } }[] }).items[0]!.card;
    await page.goto(`/en/cars/${card.id}-${card.slug}`);
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(JSON.parse(ld!)).toMatchObject({ '@type': 'Product', offers: { priceCurrency: 'EGP' } });
    await expect(page.locator('link[rel="alternate"][hreflang="ar"]')).toHaveCount(1);
    await page.goto('/ar/cairo');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('القاهرة');
  });

  for (const path of ['/ar', '/en', '/ar/search?city=cairo', '/en/cairo', '/ar/dealers', '/en/help', '/ar/for-dealers', '/en/account']) {
    test(`axe: no WCAG 2.2 AA violations on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).exclude('.maplibregl-map').analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
    });
  }
});
