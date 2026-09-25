import { Logger } from '@nestjs/common';
import type { MapPin, SearchDocument, SearchEngine, SearchResult } from './engine';
import type { SearchQuery } from './search.schemas';

/**
 * Meilisearch adapter (P6, behind FLAGS.searchEngine). Same documents as the Postgres projection.
 * Pagination uses offset cursors because Meilisearch has no keyset pagination.
 */
export class MeiliSearchEngine implements SearchEngine {
  readonly name = 'meilisearch';
  private readonly logger = new Logger('Meili');
  constructor(
    private readonly host: string,
    private readonly apiKey: string,
    private readonly index = 'listings',
  ) {}

  private async call(path: string, init: RequestInit = {}) {
    const res = await fetch(`${this.host}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`meilisearch ${path}: ${res.status}`);
    return res.json() as Promise<unknown>;
  }

  /** Index settings: filterable / sortable attributes. Idempotent; run by the reindex job. */
  async configure() {
    await this.call(`/indexes/${this.index}/settings`, {
      method: 'PATCH',
      body: JSON.stringify({
        searchableAttributes: ['searchText'],
        filterableAttributes: [
          'available',
          'citySlug',
          'areaSlug',
          'bodyType',
          'makeSlug',
          'transmission',
          'seats',
          'driverOption',
          'airportPickup',
          'priceDay',
          'priceWeek',
          'priceMonth',
          'dealerId',
          'publishedAtTs',
          '_geo',
        ],
        sortableAttributes: [
          'priceDay',
          'priceWeek',
          'priceMonth',
          'publishedAtTs',
          'lastConfirmedAtTs',
          'featuredUntilTs',
          '_geo',
        ],
        rankingRules: ['sort', 'words', 'typo', 'proximity', 'attribute', 'exactness'],
      }),
    });
  }

  async upsert(doc: SearchDocument) {
    const body = {
      ...doc,
      id: doc.listingId,
      publishedAtTs: doc.publishedAt.getTime(),
      lastConfirmedAtTs: doc.lastConfirmedAt.getTime(),
      featuredUntilTs: doc.featuredUntil?.getTime() ?? 0,
      ...(doc.lat !== null && doc.lng !== null ? { _geo: { lat: doc.lat, lng: doc.lng } } : {}),
    };
    await this.call(`/indexes/${this.index}/documents?primaryKey=id`, {
      method: 'POST',
      body: JSON.stringify([body]),
    });
  }

  async remove(listingId: string) {
    await this.call(`/indexes/${this.index}/documents/${listingId}`, { method: 'DELETE' });
  }

  private filter(q: SearchQuery): string[] {
    const price =
      q.period === 'week' ? 'priceWeek' : q.period === 'month' ? 'priceMonth' : 'priceDay';
    const f: string[] = [];
    if (!q.includeUnavailable) f.push('available = true');
    if (q.city) f.push(`citySlug = "${q.city}"`);
    if (q.area) f.push(`areaSlug = "${q.area}"`);
    if (q.type) f.push(`bodyType = "${q.type}"`);
    if (q.make) f.push(`makeSlug = "${q.make}"`);
    if (q.transmission) f.push(`transmission = "${q.transmission}"`);
    if (q.seatsMin) f.push(`seats >= ${q.seatsMin}`);
    if (q.driver === 'self') f.push('driverOption IN ["self", "both"]');
    if (q.driver === 'driver') f.push('driverOption IN ["driver", "both"]');
    if (q.driver === 'both') f.push('driverOption = "both"');
    if (q.airport) f.push('airportPickup = true');
    if (q.priceMin !== undefined) f.push(`${price} >= ${q.priceMin}`);
    if (q.priceMax !== undefined) f.push(`${price} <= ${q.priceMax}`);
    if (q.dealerId) f.push(`dealerId = "${q.dealerId}"`);
    if (q.lat !== undefined && q.lng !== undefined)
      f.push(`_geoRadius(${q.lat}, ${q.lng}, ${q.radiusKm * 1000})`);
    if (q.bbox)
      f.push(`_geoBoundingBox([${q.bbox[3]}, ${q.bbox[2]}], [${q.bbox[1]}, ${q.bbox[0]}])`);
    return f;
  }

  async search(q: SearchQuery): Promise<SearchResult> {
    const price =
      q.period === 'week' ? 'priceWeek' : q.period === 'month' ? 'priceMonth' : 'priceDay';
    const sort =
      q.sort === 'price_asc'
        ? [`${price}:asc`]
        : q.sort === 'price_desc'
          ? [`${price}:desc`]
          : q.sort === 'newest'
            ? ['publishedAtTs:desc']
            : q.sort === 'distance' && q.lat !== undefined
              ? [`_geoPoint(${q.lat}, ${q.lng}):asc`]
              : ['featuredUntilTs:desc', 'lastConfirmedAtTs:desc'];
    const offset = q.cursor ? Number(Buffer.from(q.cursor, 'base64url').toString()) || 0 : 0;
    const r = (await this.call(`/indexes/${this.index}/search`, {
      method: 'POST',
      body: JSON.stringify({ q: q.q ?? '', filter: this.filter(q), sort, offset, limit: q.limit }),
    })) as {
      hits: { card: SearchDocument['card']; _geoDistance?: number }[];
      estimatedTotalHits: number;
    };
    const next =
      offset + q.limit < r.estimatedTotalHits
        ? Buffer.from(String(offset + q.limit)).toString('base64url')
        : null;
    return {
      items: r.hits.map((h) => ({
        card: h.card,
        ...(h._geoDistance !== undefined
          ? { distanceKm: Math.round(h._geoDistance / 10) / 100 }
          : {}),
      })),
      nextCursor: next,
      total: r.estimatedTotalHits,
    };
  }

  async pins(q: SearchQuery): Promise<MapPin[]> {
    const r = (await this.call(`/indexes/${this.index}/search`, {
      method: 'POST',
      body: JSON.stringify({
        q: '',
        filter: this.filter(q),
        limit: 500,
        attributesToRetrieve: ['listingId', 'lat', 'lng', 'priceDay', 'featuredUntilTs'],
      }),
    })) as {
      hits: {
        listingId: string;
        lat: number | null;
        lng: number | null;
        priceDay: number;
        featuredUntilTs: number;
      }[];
    };
    return r.hits
      .filter((h) => h.lat !== null && h.lng !== null)
      .map((h) => ({
        id: h.listingId,
        lat: h.lat!,
        lng: h.lng!,
        price: h.priceDay,
        featured: h.featuredUntilTs > Date.now(),
      }));
  }

  async newSince(q: SearchQuery, since: Date): Promise<string[]> {
    try {
      const r = (await this.call(`/indexes/${this.index}/search`, {
        method: 'POST',
        body: JSON.stringify({
          q: '',
          filter: [...this.filter(q), `publishedAtTs > ${since.getTime()}`],
          limit: 50,
          attributesToRetrieve: ['listingId'],
        }),
      })) as { hits: { listingId: string }[] };
      return r.hits.map((h) => h.listingId);
    } catch (err) {
      this.logger.warn({ err: (err as Error).message }, 'newSince failed');
      return [];
    }
  }
}
