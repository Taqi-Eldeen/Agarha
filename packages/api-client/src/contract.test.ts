import { apiHandlers } from '@agarha/test-utils/msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ApiRequestError, createApiClient, idempotencyKey } from './client';

// The client against MSW handlers that mirror the /v1 contract (shared with component tests).
const server = setupServer(...apiHandlers('http://api.test'));
// MSW patches fetch on listen; create the client afterwards so it binds the patched fetch.
let api: ReturnType<typeof createApiClient>;
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  api = createApiClient({ baseUrl: 'http://api.test', locale: () => 'ar' });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('api client ↔ mock API', () => {
  it('searches and follows a result to its listing', async () => {
    const { data } = await api.GET('/v1/search', { params: { query: { city: 'cairo' } as never } });
    const first = (data as { items: { card: { id: string } }[] }).items[0]!;
    const detail = await api.GET('/v1/listings/{id}', { params: { path: { id: first.card.id } } });
    expect((detail.data as { card: { id: string } }).card.id).toBe(first.card.id);
  });

  it('creates a lead with an idempotency key and gets a wa.me link with the reference code', async () => {
    const { data: s } = await api.GET('/v1/search', { params: { query: { city: 'cairo' } as never } });
    const listingId = (s as { items: { card: { id: string } }[] }).items[0]!.card.id;
    const { data } = await api.POST('/v1/leads', { body: { listingId, channel: 'whatsapp', locale: 'ar' }, headers: { 'idempotency-key': idempotencyKey() } });
    expect(data?.url).toMatch(/^https:\/\/wa\.me\/20\d+\?text=.*AG-7K2Q/);
  });

  it('surfaces 404s as ApiRequestError with the API error shape', async () => {
    await expect(api.GET('/v1/listings/{id}', { params: { path: { id: '00000000-0000-4000-8000-00000000ffff' } } })).rejects.toMatchObject({ status: 404, code: 'not_found', requestId: 'req-test' });
    await expect(api.GET('/v1/listings/{id}', { params: { path: { id: '00000000-0000-4000-8000-00000000ffff' } } })).rejects.toBeInstanceOf(ApiRequestError);
  });
});
