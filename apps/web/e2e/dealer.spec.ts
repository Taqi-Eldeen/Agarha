import { expect, test } from '@playwright/test';
import { API, fillOtp, lastCode, randomMobile, stubTurnstile, totp } from './helpers';

test.describe.configure({ mode: 'serial' });

test.describe('dealer: onboarding → verification → add car', () => {
  const phone = randomMobile();
  let totpSecret = '';
  test.beforeEach(({ context }) => stubTurnstile(context));

  test('signs up with OTP, password and TOTP, then completes onboarding', async ({ page, request }) => {
    await page.goto('/en/dealer/sign-up');
    await page.getByLabel('Mobile number').fill(phone.national);
    const send = page.getByRole('button', { name: 'Send code' });
    await expect(send).toBeEnabled({ timeout: 30_000 });
    await send.click();
    await fillOtp(page, await lastCode(request, phone.e164));
    await page.getByLabel('Your name').fill('E2E Owner');
    await page.getByLabel('Password').fill('e2e password 123');
    await page.getByRole('button', { name: 'Register' }).click();
    totpSecret = (await page.locator('code').textContent())!.trim();
    await fillOtp(page, totp(totpSecret));
    await expect(page).toHaveURL(/\/en\/dealer\/onboarding/);

    // Business
    await page.getByLabel('Name on the commercial registration').fill('E2E Rentals LLC');
    await page.getByLabel('Company name in Arabic').fill('إي تو إي');
    await page.getByLabel('Company name in English').fill('E2E Rentals');
    await page.getByLabel('Commercial registration number').fill('445566');
    await page.getByLabel('Tax card number').fill('111-222-333');
    await page.getByLabel('Company phone').fill(phone.national);
    await page.getByLabel('WhatsApp number customers will message').fill(phone.national);
    await page.getByRole('button', { name: 'Branches' }).click();
    // Branch
    await page.getByRole('combobox', { name: 'City' }).selectOption({ label: 'Cairo' });
    await expect(page.getByRole('combobox', { name: 'Area' })).toBeEnabled();
    await page.getByRole('combobox', { name: 'Area' }).selectOption({ label: 'Nasr City' });
    await page.getByLabel('Branch name', { exact: true }).fill('Main');
    await page.getByLabel('Address').fill('Abbas El Akkad St');
    await page.getByRole('button', { name: 'Documents' }).click();
    // Documents
    const pdf = { name: 'doc.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% e2e\n') };
    await expect(page.getByRole('heading', { name: 'Upload documents' })).toBeVisible();
    const inputs = page.locator('input[type="file"]');
    await expect(inputs).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await inputs.nth(i).setInputFiles(pdf);
      await expect(page.getByText('Uploaded, waiting for review')).toHaveCount(i + 1, { timeout: 20_000 });
    }
    await page.getByRole('button', { name: 'Send for review' }).click();
    await expect(page.getByText('Your company is under review')).toBeVisible();
  });

  test('ops verifies the dealer (API, as the admin console does)', async ({ playwright }) => {
    const admin = await playwright.request.newContext({ extraHTTPHeaders: { origin: process.env.WEB_URL ?? 'http://localhost:3000' } });
    const step = (await (await admin.post(`${API}/v1/auth/admin/dev-login`, { data: { email: 'admin@agarha.com' } })).json()) as { next: string; loginToken: string };
    expect(step.next).toBe('totp');
    const auth = await admin.post(`${API}/v1/auth/admin/totp`, { data: { loginToken: step.loginToken, code: totp(process.env.E2E_ADMIN_TOTP_SECRET ?? 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP') } });
    expect(auth.ok()).toBeTruthy();
    const dealers = (await (await admin.get(`${API}/v1/admin/dealers?status=pending_review`)).json()) as { items: { id: string; displayNameEn: string }[] };
    const d = dealers.items.find((x) => x.displayNameEn === 'E2E Rentals')!;
    const docs = (await (await admin.get(`${API}/v1/admin/dealers/${d.id}/documents`)).json()) as { items: { id: string }[] };
    for (const doc of docs.items) expect((await admin.post(`${API}/v1/admin/documents/${doc.id}/review`, { data: { approve: true } })).ok()).toBeTruthy();
    expect((await admin.post(`${API}/v1/admin/dealers/${d.id}/verify`)).ok()).toBeTruthy();
    await admin.dispose();
  });

  test('adds a car in the wizard with a photo and publishes it', async ({ page, request }) => {
    await page.goto('/en/dealer/sign-in');
    await page.getByLabel('Mobile number').fill(phone.national);
    await page.getByLabel('Password').fill('e2e password 123');
    const signIn = page.getByRole('button', { name: 'Sign in' });
    await expect(signIn).toBeEnabled({ timeout: 30_000 });
    await signIn.click();
    await page.waitForTimeout(31_000 - (Date.now() % 30_000)); // next TOTP step (the previous code was used)
    await fillOtp(page, totp(totpSecret));
    await expect(page).toHaveURL(/\/en\/dealer\/fleet/);
    await page.getByRole('link', { name: 'Add a car' }).first().click();
    await page.getByRole('combobox', { name: 'Make' }).click();
    await page.getByRole('option', { name: /Toyota/ }).click();
    await page.getByRole('combobox', { name: 'Model' }).click();
    await page.getByRole('option', { name: /Corolla/ }).click();
    await page.getByLabel('Colour').fill('white');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('Price per day (EGP)').fill('1300');
    await page.getByLabel('Deposit (EGP)').fill('4000');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    const jpeg = await (await request.get(`${API}/v1/search?limit=1`)).json().then(async (r: { items: { card: { photo: { url640: string } } }[] }) => (await request.get(r.items[0]!.card.photo.url640)).body());
    await page.locator('input[type="file"]').setInputFiles({ name: 'car.webp', mimeType: 'image/webp', buffer: jpeg });
    await expect(page.getByRole('button', { name: 'Save and publish' })).toBeEnabled({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Save and publish' }).click();
    await expect(page).toHaveURL(/\/en\/dealer\/fleet/);
    await expect(page.getByText(/In review|Live/).first()).toBeVisible();
  });
});
