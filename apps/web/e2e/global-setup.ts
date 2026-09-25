import { request } from '@playwright/test';
import { API } from './helpers';

/** Local runs reuse one API + Redis: clear rate-limit counters so reruns don't hit 429s. */
export default async function globalSetup() {
  const ctx = await request.newContext();
  await ctx.post(`${API}/v1/dev/reset-limits`).catch(() => undefined);
  await ctx.dispose();
}
