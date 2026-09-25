import { describe, expect, it, vi } from 'vitest';
import { ApiRequestError, createApiClient } from './client';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('api client', () => {
  it('refreshes once on 401 and retries with the new token (mobile)', async () => {
    let tokens: { accessToken: string; refreshToken: string } | null = { accessToken: 'old', refreshToken: 'r1' };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = input instanceof Request ? input : new Request(input, init);
      if (req.url.endsWith('/v1/auth/refresh')) return json(200, { tokens: { accessToken: 'new', refreshToken: 'r2' } });
      return req.headers.get('authorization') === 'Bearer new' ? json(200, { id: 'u1' }) : json(401, { code: 'unauthorized', message: 'x', requestId: 'r' });
    });
    const api = createApiClient({ baseUrl: 'http://api', fetch: fetchMock as typeof fetch, tokens: { get: async () => tokens, set: async (t) => void (tokens = t) } });
    const r = await api.GET('/v1/me');
    expect(r.data).toEqual({ id: 'u1' });
    expect(tokens).toEqual({ accessToken: 'new', refreshToken: 'r2' });
  });

  it('turns API errors into ApiRequestError with code and requestId', async () => {
    const api = createApiClient({ baseUrl: 'http://api', fetch: (async () => json(429, { code: 'rate_limited', message: 'slow down', requestId: 'req-1', details: { retryAfterSeconds: 60 } })) as typeof fetch });
    await expect(api.GET('/v1/catalog/cities')).rejects.toMatchObject({ status: 429, code: 'rate_limited', requestId: 'req-1' });
    await expect(api.GET('/v1/catalog/cities')).rejects.toBeInstanceOf(ApiRequestError);
  });

  it('sends Accept-Language from the current locale', async () => {
    const seen: string[] = [];
    const api = createApiClient({ baseUrl: 'http://api', locale: () => 'en', fetch: (async (i: RequestInfo | URL) => { seen.push((i as Request).headers.get('accept-language') ?? ''); return json(200, { items: [] }); }) as typeof fetch });
    await api.GET('/v1/catalog/cities');
    expect(seen).toEqual(['en']);
  });
});
