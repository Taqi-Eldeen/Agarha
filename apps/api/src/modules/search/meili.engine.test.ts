import { MeiliSearchEngine } from './meili.engine';
import type { SearchDocument } from './engine';
import { searchQuerySchema } from './search.schemas';

type Call = { url: string; init: RequestInit & { body?: string } };

describe('MeiliSearchEngine', () => {
  const calls: Call[] = [];
  let reply: unknown = {};
  let ok = true;
  beforeEach(() => {
    calls.length = 0;
    ok = true;
    reply = {};
    global.fetch = jest.fn(async (url: string, init: Call['init']) => {
      calls.push({ url, init });
      return { ok, status: ok ? 200 : 503, json: async () => reply } as Response;
    }) as unknown as typeof fetch;
  });
  const engine = new MeiliSearchEngine('http://meili:7700', 'key');
  const body = (i = 0) => JSON.parse(calls[i]!.init.body!) as Record<string, unknown>;
  const q = (o: Record<string, unknown>) => searchQuerySchema.parse(o);

  it('configures filterable and sortable attributes with the API key', async () => {
    await engine.configure();
    expect(calls[0]!.url).toBe('http://meili:7700/indexes/listings/settings');
    expect(calls[0]!.init.method).toBe('PATCH');
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe('Bearer key');
    expect(body().filterableAttributes).toContain('_geo');
  });

  it('upserts documents with timestamps and _geo, and removes by id', async () => {
    const doc = {
      listingId: 'l1',
      publishedAt: new Date(1000),
      lastConfirmedAt: new Date(2000),
      featuredUntil: null,
      lat: 30,
      lng: 31,
    } as unknown as SearchDocument;
    await engine.upsert(doc);
    expect(body()).toEqual([
      expect.objectContaining({
        id: 'l1',
        publishedAtTs: 1000,
        lastConfirmedAtTs: 2000,
        featuredUntilTs: 0,
        _geo: { lat: 30, lng: 31 },
      }),
    ]);
    await engine.remove('l1');
    expect(calls[1]!.url).toBe('http://meili:7700/indexes/listings/documents/l1');
    expect(calls[1]!.init.method).toBe('DELETE');
  });

  it('translates every filter, sort and cursor', async () => {
    reply = { hits: [{ card: { id: 'c1' }, _geoDistance: 1234 }], estimatedTotalHits: 30 };
    const r = await engine.search(
      q({
        city: 'cairo',
        area: 'maadi',
        type: 'suv',
        make: 'toyota',
        transmission: 'automatic',
        seatsMin: 5,
        driver: 'self',
        airport: 'true',
        period: 'week',
        priceMin: 100,
        priceMax: 900,
        lat: 30,
        lng: 31,
        sort: 'distance',
        bbox: '31,29,32,30',
        limit: 10,
      }),
    );
    const b = body();
    expect(b.filter).toEqual(
      expect.arrayContaining([
        'available = true',
        'citySlug = "cairo"',
        'areaSlug = "maadi"',
        'bodyType = "suv"',
        'makeSlug = "toyota"',
        'transmission = "automatic"',
        'seats >= 5',
        'driverOption IN ["self", "both"]',
        'airportPickup = true',
        'priceWeek >= 100',
        'priceWeek <= 900',
        '_geoRadius(30, 31, 15000)',
        '_geoBoundingBox([30, 32], [29, 31])',
      ]),
    );
    expect(b.sort).toEqual(['_geoPoint(30, 31):asc']);
    expect(r).toEqual({
      items: [{ card: { id: 'c1' }, distanceKm: 1.23 }],
      nextCursor: Buffer.from('10').toString('base64url'),
      total: 30,
    });

    for (const [sort, expected] of [
      ['price_asc', ['priceDay:asc']],
      ['price_desc', ['priceDay:desc']],
      ['newest', ['publishedAtTs:desc']],
      ['relevance', ['featuredUntilTs:desc', 'lastConfirmedAtTs:desc']],
    ] as const) {
      calls.length = 0;
      reply = { hits: [], estimatedTotalHits: 0 };
      const res = await engine.search(q({ sort, cursor: Buffer.from('20').toString('base64url') }));
      expect(body().sort).toEqual(expected);
      expect(body().offset).toBe(20);
      expect(res.nextCursor).toBeNull();
    }
    for (const [driver, clause] of [
      ['driver', 'driverOption IN ["driver", "both"]'],
      ['both', 'driverOption = "both"'],
    ] as const) {
      calls.length = 0;
      await engine.search(q({ driver, includeUnavailable: 'true', period: 'month', priceMin: 1 }));
      expect(body().filter).toEqual([clause, 'priceMonth >= 1']);
    }
  });

  it('returns map pins with coordinates only, and new listings since a date', async () => {
    reply = {
      hits: [
        { listingId: 'a', lat: 30, lng: 31, priceDay: 900, featuredUntilTs: Date.now() + 1e6 },
        { listingId: 'b', lat: null, lng: null, priceDay: 500, featuredUntilTs: 0 },
      ],
    };
    expect(await engine.pins(q({ dealerId: '11111111-1111-4111-8111-111111111111' }))).toEqual([
      { id: 'a', lat: 30, lng: 31, price: 900, featured: true },
    ]);
    expect(body().filter).toContain('dealerId = "11111111-1111-4111-8111-111111111111"');
    calls.length = 0;
    reply = { hits: [{ listingId: 'n1' }] };
    expect(await engine.newSince(q({}), new Date(5000))).toEqual(['n1']);
    expect(body().filter).toContain('publishedAtTs > 5000');
  });

  it('surfaces HTTP errors, except for saved-search matching which degrades to no matches', async () => {
    ok = false;
    await expect(engine.search(q({}))).rejects.toThrow('meilisearch /indexes/listings/search: 503');
    expect(await engine.newSince(q({}), new Date())).toEqual([]);
  });
});
