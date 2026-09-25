import { ProviderError } from '../channels';

/** fetch with a hard timeout; non-2xx becomes ProviderError (4xx not retryable except 429). */
export async function postForm(provider: string, url: string, form: Record<string, string>, headers: Record<string, string> = {}, timeoutMs = 8000): Promise<unknown> {
  return request(provider, url, { method: 'POST', body: new URLSearchParams(form), headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers } }, timeoutMs);
}

export async function postJson(provider: string, url: string, body: unknown, headers: Record<string, string> = {}, timeoutMs = 8000): Promise<unknown> {
  return request(provider, url, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } }, timeoutMs);
}

async function request(provider: string, url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    throw new ProviderError(provider, `network: ${(e as Error).message}`);
  }
  const text = await res.text();
  if (!res.ok) throw new ProviderError(provider, `HTTP ${res.status}: ${text.slice(0, 200)}`, res.status === 429 || res.status >= 500);
  try {
    return text ? (JSON.parse(text) as unknown) : {};
  } catch {
    return {};
  }
}
