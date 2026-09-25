import { http, HttpResponse } from 'msw';
import { leadResponse, listingCard, listingDetail, searchResult } from './factories.js';

/**
 * Mock API for component and client tests (and Storybook). Mirrors the /v1 contract shapes; tests
 * override single routes with server.use(...).
 */
export function apiHandlers(baseUrl = 'http://api.test') {
  const cards = [listingCard({ featured: true }), listingCard(), listingCard({ available: false })];
  return [
    http.get(`${baseUrl}/v1/catalog/cities`, () =>
      HttpResponse.json({
        items: [
          {
            id: '00000000-0000-4000-8000-00000000c001',
            slug: 'cairo',
            nameAr: 'القاهرة',
            nameEn: 'Cairo',
            isActive: true,
            lat: 30.04,
            lng: 31.24,
          },
          {
            id: '00000000-0000-4000-8000-00000000c002',
            slug: 'giza',
            nameAr: 'الجيزة',
            nameEn: 'Giza',
            isActive: true,
            lat: 30.01,
            lng: 31.21,
          },
        ],
      }),
    ),
    http.get(`${baseUrl}/v1/search`, ({ request }) => {
      const city = new URL(request.url).searchParams.get('city');
      return HttpResponse.json(
        city === 'nowhere'
          ? searchResult(0)
          : { items: cards.map((card) => ({ card })), nextCursor: null, total: cards.length },
      );
    }),
    http.get(`${baseUrl}/v1/listings/:id`, ({ params }) => {
      const card = cards.find((c) => c.id === params.id);
      return card
        ? HttpResponse.json(listingDetail(card))
        : HttpResponse.json(
            { code: 'not_found', message: 'Listing not found', requestId: 'req-test' },
            { status: 404 },
          );
    }),
    http.post(`${baseUrl}/v1/leads`, async ({ request }) => {
      if (!request.headers.get('idempotency-key'))
        return HttpResponse.json(
          { code: 'validation_failed', message: 'Idempotency-Key required', requestId: 'req-test' },
          { status: 400 },
        );
      const body = (await request.json()) as { listingId: string; channel: 'whatsapp' | 'call' };
      const card = cards.find((c) => c.id === body.listingId) ?? cards[0]!;
      return HttpResponse.json(leadResponse(card, body.channel), { status: 201 });
    }),
  ];
}
