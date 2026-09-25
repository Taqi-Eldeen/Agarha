import type { APIRequestContext, BrowserContext, Page } from '@playwright/test';
import { authenticator } from 'otplib';

export const API = process.env.API_URL ?? 'http://localhost:4000';

/** Reads the latest code the mock SMS/WhatsApp adapter "sent" (local/test only endpoint). */
export async function lastCode(request: APIRequestContext, e164: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const r = await request.get(`${API}/v1/dev/outbox?to=${encodeURIComponent(e164)}`);
    const body = (await r.json()) as { items: { body: string }[] };
    const m = body.items[0]?.body.match(/\d{6}/);
    if (m) return m[0];
    await new Promise((res) => setTimeout(res, 500));
  }
  throw new Error(`no code for ${e164}`);
}

export const totp = (secret: string) => authenticator.generate(secret);

export function randomMobile(): { national: string; e164: string } {
  const n = `010${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
  return { national: n, e164: `+2${n}` };
}

/** Fills the 6-box OTP field (paste into the first box). */
export async function fillOtp(page: Page, code: string) {
  await page.locator('input[autocomplete="one-time-code"]').fill(code);
}

/** Waits for the Turnstile test widget to issue a token (the submit button enables). */
export async function waitForCaptcha(page: Page, buttonName: RegExp) {
  await page
    .getByRole('button', { name: buttonName })
    .and(page.locator(':not([disabled])'))
    .waitFor({ timeout: 30_000 });
}

/**
 * Replaces the Turnstile script with a stub that issues Cloudflare's dummy token at once, so E2E
 * never depends on challenges.cloudflare.com. The API accepts it only with the test secret.
 */
export async function stubTurnstile(context: BrowserContext) {
  await context.route(/challenges\.cloudflare\.com\/turnstile\/.*/, (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.turnstile={render:function(el,o){setTimeout(function(){o.callback('XXXX.DUMMY.TOKEN.XXXX')},50);return 'stub'},remove:function(){},reset:function(){}};`,
    }),
  );
}
