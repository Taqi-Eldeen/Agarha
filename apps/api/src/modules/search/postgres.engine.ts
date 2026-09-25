import { normalizeArabic } from '@agarha/schemas';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';
import { decodeCursor, encodeCursor } from '../../common/pagination';
import { DB, type Database } from '../../db/db';
import { searchDocuments as d } from '../../db/schema/search';
import type { ListingCard, MapPin, SearchDocument, SearchEngine, SearchResult } from './engine';
import type { SearchQuery } from './search.schemas';

const FOURTEEN_DAYS_S = 14 * 86_400;

@Injectable()
export class PostgresSearchEngine implements SearchEngine {
  readonly name = 'postgres';
  constructor(@Inject(DB) private readonly db: Database) {}

  async upsert(doc: SearchDocument) {
    const values = {
      listingId: doc.listingId,
      dealerId: doc.dealerId,
      available: doc.available,
      citySlug: doc.citySlug,
      areaSlug: doc.areaSlug,
      bodyType: doc.bodyType as never,
      makeSlug: doc.makeSlug,
      modelSlug: doc.modelSlug,
      transmission: doc.transmission as never,
      fuel: doc.fuel as never,
      seats: doc.seats,
      year: doc.year,
      driverOption: doc.driverOption as never,
      airportPickup: doc.airportPickup,
      priceDay: doc.priceDay,
      priceWeek: doc.priceWeek,
      priceMonth: doc.priceMonth,
      deposit: doc.deposit,
      featuredUntil: doc.featuredUntil,
      lastConfirmedAt: doc.lastConfirmedAt,
      publishedAt: doc.publishedAt,
      location: (doc.lat !== null && doc.lng !== null ? sql`ST_SetSRID(ST_MakePoint(${doc.lng}, ${doc.lat}), 4326)` : null) as never,
      searchText: doc.searchText,
      card: doc.card,
      indexedAt: new Date(),
    };
    await this.db.insert(d).values(values).onConflictDoUpdate({ target: d.listingId, set: values });
  }

  async remove(listingId: string) {
    await this.db.delete(d).where(eq(d.listingId, listingId));
  }

  private priceCol(period: SearchQuery['period']) {
    return period === 'week' ? d.priceWeek : period === 'month' ? d.priceMonth : d.priceDay;
  }

  private filters(q: SearchQuery): SQL[] {
    const f: SQL[] = [];
    const price = this.priceCol(q.period);
    if (!q.includeUnavailable) f.push(eq(d.available, true));
    if (q.city) f.push(eq(d.citySlug, q.city));
    if (q.area) f.push(eq(d.areaSlug, q.area));
    if (q.type) f.push(eq(d.bodyType, q.type));
    if (q.make) f.push(eq(d.makeSlug, q.make));
    if (q.transmission) f.push(eq(d.transmission, q.transmission));
    if (q.seatsMin) f.push(gte(d.seats, q.seatsMin));
    if (q.driver === 'self') f.push(inArray(d.driverOption, ['self', 'both']));
    else if (q.driver === 'driver') f.push(inArray(d.driverOption, ['driver', 'both']));
    else if (q.driver === 'both') f.push(eq(d.driverOption, 'both'));
    if (q.airport) f.push(eq(d.airportPickup, true));
    if (q.priceMin !== undefined) f.push(gte(price, q.priceMin));
    if (q.priceMax !== undefined) f.push(lte(price, q.priceMax));
    if (q.dealerId) f.push(eq(d.dealerId, q.dealerId));
    if (q.q) {
      const n = normalizeArabic(q.q);
      // word_similarity (<%): the query is matched against the closest run of words, so short typo'd queries still hit long documents.
      f.push(sql`(${n} <% ${d.searchText} OR ${d.searchText} LIKE ${'%' + n + '%'})`);
    }
    if (q.bbox) f.push(sql`${d.location} && ST_MakeEnvelope(${q.bbox[0]}, ${q.bbox[1]}, ${q.bbox[2]}, ${q.bbox[3]}, 4326)`);
    if (q.lat !== undefined && q.lng !== undefined)
      f.push(sql`ST_DWithin(${d.location}::geography, ST_SetSRID(ST_MakePoint(${q.lng}, ${q.lat}), 4326)::geography, ${q.radiusKm * 1000})`);
    return f;
  }

  /**
   * Relevance = featured boost + freshness (linear decay to 0 at 14 days) + text similarity.
   * Freshness boosts ranking (risk #1).
   */
  private rank(q: SearchQuery, now: Date): SQL<number> {
    const nowTs = now.toISOString();
    const fresh = sql`GREATEST(0, 1 - EXTRACT(EPOCH FROM (${nowTs}::timestamptz - ${d.lastConfirmedAt})) / ${FOURTEEN_DAYS_S})`;
    const featured = sql`CASE WHEN ${d.featuredUntil} > ${nowTs}::timestamptz THEN 1 ELSE 0 END`;
    const text = q.q ? sql`word_similarity(${normalizeArabic(q.q)}, ${d.searchText})` : sql`0`;
    return sql<number>`round((${featured} * 0.4 + ${fresh} * 0.5 + ${text} * 0.3)::numeric, 6)::float8`;
  }

  async search(q: SearchQuery, now: Date): Promise<SearchResult> {
    const where = and(...this.filters(q));
    const price = this.priceCol(q.period);
    const point = q.lat !== undefined && q.lng !== undefined ? sql`ST_SetSRID(ST_MakePoint(${q.lng}, ${q.lat}), 4326)::geography` : null;
    const distance = point ? sql<number>`round((ST_Distance(${d.location}::geography, ${point}) / 1000)::numeric, 2)::float8` : sql<number>`0::float8`;

    type Key = { k: number | string; id: string };
    const sortKey: SQL<number | string> =
      q.sort === 'price_asc' || q.sort === 'price_desc' ? sql<number>`${price}` : q.sort === 'newest' ? sql<string>`to_char(${d.publishedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')` : q.sort === 'distance' && point ? distance : this.rank(q, now);
    const asc = q.sort === 'price_asc' || (q.sort === 'distance' && !!point);
    const c = decodeCursor<Key>(q.cursor);
    const after = c ? (asc ? sql`(${sortKey}, ${d.listingId}) > (${c.k}, ${c.id}::uuid)` : sql`(${sortKey} < ${c.k} OR (${sortKey} = ${c.k} AND ${d.listingId} < ${c.id}::uuid))`) : undefined;

    const rows = await this.db
      .select({ card: d.card, k: sortKey, id: d.listingId, distance })
      .from(d)
      .where(and(where, after))
      .orderBy(asc ? sql`${sortKey} ASC, ${d.listingId} ASC` : sql`${sortKey} DESC, ${d.listingId} DESC`)
      .limit(q.limit + 1);
    const [{ total } = { total: 0 }] = await this.db.select({ total: sql<number>`count(*)::int` }).from(d).where(where);
    const page = rows.slice(0, q.limit);
    const last = page.at(-1);
    return {
      items: page.map((r) => ({ card: r.card as ListingCard, ...(point ? { distanceKm: r.distance } : {}) })),
      nextCursor: rows.length > q.limit && last ? encodeCursor({ k: last.k, id: last.id }) : null,
      total,
    };
  }

  async pins(q: SearchQuery): Promise<MapPin[]> {
    const price = this.priceCol(q.period);
    const rows = await this.db
      .select({ id: d.listingId, lat: sql<number>`ST_Y(${d.location})`, lng: sql<number>`ST_X(${d.location})`, price, featured: sql<boolean>`${d.featuredUntil} > now()` })
      .from(d)
      .where(and(...this.filters(q), sql`${d.location} IS NOT NULL`))
      .limit(500);
    return rows.map((r) => ({ ...r, featured: !!r.featured }));
  }

  async newSince(q: SearchQuery, since: Date): Promise<string[]> {
    const rows = await this.db.select({ id: d.listingId }).from(d).where(and(...this.filters(q), sql`${d.publishedAt} > ${since.toISOString()}::timestamptz`)).limit(50);
    return rows.map((r) => r.id);
  }
}
