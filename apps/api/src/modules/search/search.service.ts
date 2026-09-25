import { normalizeArabic } from '@agarha/schemas';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import { Errors } from '../../common/errors';
import { DB, type Database } from '../../db/db';
import { savedSearches, searchDocuments } from '../../db/schema/search';
import { EventBus } from '../../infra/events';
import { FLAGS, FlagsService } from '../../infra/flags';
import { PrivacyRegistry } from '../../infra/privacy';
import { REDIS } from '../../infra/redis/redis';
import { AnalyticsService } from '../analytics';
import { CatalogService } from '../catalog';
import { DealersService } from '../dealers';
import { LeadsService } from '../leads';
import { ListingsService } from '../listings';
import { NotificationsService } from '../notifications';
import { ReviewsService } from '../reviews';
import { SEARCH_ENGINES, type ListingCard, type SearchDocument, type SearchEngine } from './engine';
import { searchQuerySchema, type SearchQuery } from './search.schemas';

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger('Search');
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(SEARCH_ENGINES) private readonly engines: { postgres: SearchEngine; meili: SearchEngine | null },
    private readonly flags: FlagsService,
    private readonly events: EventBus,
    private readonly listings: ListingsService,
    private readonly dealers: DealersService,
    private readonly catalog: CatalogService,
    private readonly reviews: ReviewsService,
    private readonly leads: LeadsService,
    private readonly analytics: AnalyticsService,
    private readonly notifications: NotificationsService,
    private readonly privacy: PrivacyRegistry,
  ) {}

  onModuleInit() {
    this.events.on('listing.changed', ({ listingId }) => this.reindex(listingId));
    this.events.on('dealer.verified', ({ dealerId }) => this.reindexDealer(dealerId));
    this.privacy.register({
      name: 'savedSearches',
      export: (userId) => this.db.select({ name: savedSearches.name, query: savedSearches.query, alertsEnabled: savedSearches.alertsEnabled, createdAt: savedSearches.createdAt }).from(savedSearches).where(eq(savedSearches.userId, userId)),
      erase: async (userId) => {
        await this.db.delete(savedSearches).where(eq(savedSearches.userId, userId));
      },
    });
  }

  /** Engine for reads: Meilisearch when the P6 flag is on and configured, else Postgres. */
  private async engine(): Promise<SearchEngine> {
    if (this.engines.meili && (await this.flags.isEnabled(FLAGS.searchEngine))) return this.engines.meili;
    return this.engines.postgres;
  }

  private all(): SearchEngine[] {
    return [this.engines.postgres, ...(this.engines.meili ? [this.engines.meili] : [])];
  }

  // ---- indexing ---------------------------------------------------------
  async buildDocument(listingId: string): Promise<SearchDocument | null> {
    const l = await this.listings.publicOne(listingId);
    if (!l) return null;
    const [model, dealer, branch] = await Promise.all([this.catalog.model(l.carModelId), this.dealers.get(l.dealerId), this.dealers.branch(l.dealerId, l.branchId)]);
    const area = await this.catalog.area(branch.areaId);
    if (!model || !area) return null;
    const first = l.photos[0];
    const card: ListingCard = {
      id: l.id,
      slug: l.slug,
      photo: first?.urls ? { url320: first.urls.webp?.['320'] ?? null, url640: first.urls.webp?.['640'] ?? null, blurhash: first.blurhash } : null,
      photoCount: l.photos.length,
      make: { ar: model.makeNameAr, en: model.makeNameEn },
      model: { ar: model.nameAr, en: model.nameEn },
      bodyType: model.bodyType,
      year: l.year,
      transmission: l.transmission,
      seats: l.seats,
      driverOption: l.driverOption,
      prices: l.prices,
      requiredDocs: l.requiredDocs,
      minAge: l.minAge,
      kmLimitPerDay: l.kmLimitPerDay,
      airportPickup: l.airportPickup,
      lastConfirmedAt: l.lastConfirmedAt,
      available: l.available,
      featured: l.featured,
      dealer: { id: dealer.id, slug: dealer.slug, nameAr: dealer.displayNameAr, nameEn: dealer.displayNameEn, verified: this.dealers.isPublic(dealer), whatsapp: branch.whatsapp ?? dealer.whatsappE164, phone: branch.phone ?? dealer.phoneE164 },
      area: { slug: area.slug, ar: area.nameAr, en: area.nameEn },
      city: { slug: area.citySlug, ar: area.cityNameAr, en: area.cityNameEn },
      location: branch.lat !== null && branch.lng !== null ? { lat: branch.lat, lng: branch.lng } : null,
    };
    return {
      listingId: l.id,
      dealerId: l.dealerId,
      available: l.available,
      citySlug: area.citySlug,
      areaSlug: area.slug,
      bodyType: model.bodyType,
      makeSlug: model.makeSlug,
      modelSlug: model.slug,
      transmission: l.transmission,
      fuel: l.fuel,
      seats: l.seats,
      year: l.year,
      driverOption: l.driverOption,
      airportPickup: l.airportPickup,
      priceDay: l.prices.day,
      priceWeek: l.prices.week ?? l.prices.day * 7,
      priceMonth: l.prices.month ?? l.prices.day * 30,
      deposit: l.prices.deposit,
      featuredUntil: l.featuredUntil ? new Date(l.featuredUntil) : null,
      lastConfirmedAt: new Date(l.lastConfirmedAt),
      publishedAt: new Date(l.publishedAt ?? l.updatedAt),
      lat: card.location?.lat ?? null,
      lng: card.location?.lng ?? null,
      searchText: normalizeArabic([model.makeNameAr, model.makeNameEn, model.nameAr, model.nameEn, String(l.year), area.nameAr, area.nameEn, area.cityNameAr, area.cityNameEn, dealer.displayNameAr, dealer.displayNameEn].join(' ')),
      card,
    };
  }

  async reindex(listingId: string) {
    const doc = await this.buildDocument(listingId);
    for (const e of this.all()) {
      try {
        if (doc) await e.upsert(doc);
        else await e.remove(listingId);
      } catch (err) {
        this.logger.error({ err: (err as Error).message, engine: e.name, listingId }, 'index failed');
      }
    }
    await this.redis.del('seo:sitemap');
  }

  private async reindexDealer(dealerId: string) {
    const fleet = await this.listings.fleet(dealerId, { status: 'live', limit: 100 });
    for (const l of fleet.items) await this.reindex(l.id);
  }

  /** Full rebuild (hourly safety net + after deploys): drops docs that are no longer public. */
  async reindexAll() {
    const ids = await this.listings.liveIds();
    for (const id of ids) await this.reindex(id);
    const live = new Set(ids);
    const indexed = await this.db.select({ id: searchDocuments.listingId }).from(searchDocuments);
    for (const r of indexed) if (!live.has(r.id)) await this.reindex(r.id);
    return { indexed: ids.length };
  }

  // ---- queries ----------------------------------------------------------
  async search(q: SearchQuery) {
    return (await this.engine()).search(q, new Date());
  }

  async pins(q: SearchQuery) {
    return { items: await (await this.engine()).pins(q) };
  }

  /** Listing page: the listing, dealer card with trust signals, branch, and similar cars. */
  async listingDetail(id: string, visitor: string) {
    const l = await this.listings.publicOne(id);
    if (!l) throw Errors.notFound('Listing');
    const doc = await this.buildDocument(id);
    if (!doc) throw Errors.notFound('Listing');
    const dealer = await this.dealers.get(l.dealerId);
    const [reviewSummary, responseRate, model] = await Promise.all([this.reviews.summary(dealer.id), this.leads.responseRate(dealer.id), this.catalog.model(l.carModelId)]);
    await this.analytics.recordView(l.id, l.dealerId, visitor);
    const similar = await this.search(searchQuerySchema.parse({ city: doc.citySlug, type: doc.bodyType, limit: 5 }));
    return {
      listing: { ...l, model },
      card: doc.card,
      dealer: { id: dealer.id, slug: dealer.slug, nameAr: dealer.displayNameAr, nameEn: dealer.displayNameEn, verified: this.dealers.isPublic(dealer), verifiedAt: dealer.verifiedAt, memberSince: dealer.createdAt, reviews: reviewSummary, responseRate },
      similar: similar.items.filter((i) => i.card.id !== id).slice(0, 4).map((i) => i.card),
      safety: { neverPayDepositBeforeSeeing: true, agarhaIsNotAParty: true },
    };
  }

  async dealerProfile(slug: string) {
    const d = await this.dealers.bySlug(slug);
    if (!d || !this.dealers.isPublic(d)) throw Errors.notFound('Dealer');
    const [branches, reviewSummary, responseRate, fleet, latestReviews] = await Promise.all([
      this.dealers.branches(d.id),
      this.reviews.summary(d.id),
      this.leads.responseRate(d.id),
      this.search(searchQuerySchema.parse({ dealerId: d.id, includeUnavailable: true, limit: 50 })),
      this.reviews.publicForDealer(d.id, { limit: 5 }),
    ]);
    const areas = new Map<string, Awaited<ReturnType<CatalogService['area']>>>();
    for (const b of branches) if (!areas.has(b.areaId)) areas.set(b.areaId, await this.catalog.area(b.areaId));
    return {
      dealer: { id: d.id, slug: d.slug, nameAr: d.displayNameAr, nameEn: d.displayNameEn, descriptionAr: d.descriptionAr, descriptionEn: d.descriptionEn, verified: true, verifiedAt: d.verifiedAt, memberSince: d.createdAt, whatsapp: d.whatsappE164, phone: d.phoneE164 },
      branches: branches.map((b) => ({ ...b, area: areas.get(b.areaId) })),
      reviews: { ...reviewSummary, latest: latestReviews.items },
      responseRate,
      fleet: fleet.items.map((i) => i.card),
      fleetTotal: fleet.total,
    };
  }

  /** City / area / car-type landing (SEO): counts and price ranges from the projection. */
  async landing(citySlug: string, filter: { area?: string; type?: string }) {
    const city = await this.catalog.cityBySlug(citySlug);
    const areas = await this.catalog.areas(city.id);
    const base = and(eq(searchDocuments.citySlug, citySlug), eq(searchDocuments.available, true));
    const byArea = await this.db.select({ area: searchDocuments.areaSlug, n: sql<number>`count(*)::int` }).from(searchDocuments).where(base).groupBy(searchDocuments.areaSlug);
    const byType = await this.db.select({ type: searchDocuments.bodyType, n: sql<number>`count(*)::int`, min: sql<number>`min(${searchDocuments.priceDay})::int` }).from(searchDocuments).where(and(base, filter.area ? eq(searchDocuments.areaSlug, filter.area) : undefined)).groupBy(searchDocuments.bodyType);
    const [range] = await this.db
      .select({ n: sql<number>`count(*)::int`, min: sql<number | null>`min(${searchDocuments.priceDay})::int`, max: sql<number | null>`max(${searchDocuments.priceDay})::int`, median: sql<number | null>`percentile_cont(0.5) WITHIN GROUP (ORDER BY ${searchDocuments.priceDay})::int` })
      .from(searchDocuments)
      .where(and(base, filter.area ? eq(searchDocuments.areaSlug, filter.area) : undefined, filter.type ? eq(searchDocuments.bodyType, filter.type as never) : undefined));
    const counts = new Map(byArea.map((a) => [a.area, a.n]));
    const results = await this.search(searchQuerySchema.parse({ city: citySlug, ...(filter.area ? { area: filter.area } : {}), ...(filter.type ? { type: filter.type } : {}), limit: 12 }));
    return {
      city,
      area: filter.area ? (areas.find((a) => a.slug === filter.area) ?? null) : null,
      type: filter.type ?? null,
      areas: areas.map((a) => ({ ...a, listings: counts.get(a.slug) ?? 0 })),
      types: byType,
      stats: range ?? { n: 0, min: null, max: null, median: null },
      listings: results.items.map((i) => i.card),
      total: results.total,
    };
  }

  /** Sitemap source (cached; the sitemap job and every reindex refresh it). */
  async sitemap() {
    const cached = await this.redis.get('seo:sitemap');
    if (cached) return JSON.parse(cached) as unknown;
    const cities = await this.catalog.cities();
    const areaRows = await this.db.select({ city: searchDocuments.citySlug, area: searchDocuments.areaSlug }).from(searchDocuments).groupBy(searchDocuments.citySlug, searchDocuments.areaSlug);
    const typeRows = await this.db.select({ city: searchDocuments.citySlug, type: searchDocuments.bodyType }).from(searchDocuments).groupBy(searchDocuments.citySlug, searchDocuments.bodyType);
    const listingRows = await this.db.select({ id: searchDocuments.listingId, card: searchDocuments.card, updatedAt: searchDocuments.indexedAt }).from(searchDocuments);
    const dealers = await this.dealers.allPublicIds();
    const out = {
      generatedAt: new Date().toISOString(),
      cities: cities.map((c) => c.slug),
      areas: areaRows,
      types: typeRows,
      listings: listingRows.map((r) => ({ id: r.id, slug: (r.card as ListingCard).slug, updatedAt: r.updatedAt })),
      dealers: dealers.map((d) => ({ slug: d.slug, updatedAt: d.updatedAt })),
    };
    await this.redis.set('seo:sitemap', JSON.stringify(out), 'EX', 3600);
    return out;
  }

  async rebuildSitemap() {
    await this.redis.del('seo:sitemap');
    return this.sitemap();
  }

  // ---- saved searches (P4) ---------------------------------------------
  listSaved(userId: string) {
    return this.db.select().from(savedSearches).where(eq(savedSearches.userId, userId)).orderBy(desc(savedSearches.createdAt));
  }

  async createSaved(userId: string, input: { name?: string | undefined; query: Record<string, unknown>; alertsEnabled: boolean }) {
    const existing = await this.listSaved(userId);
    if (existing.length >= 20) throw Errors.conflict('You can save up to 20 searches');
    const [r] = await this.db.insert(savedSearches).values({ userId, name: input.name ?? null, query: input.query, alertsEnabled: input.alertsEnabled, lastNotifiedAt: new Date() }).returning();
    return r!;
  }

  async updateSaved(userId: string, id: string, patch: { name?: string | undefined; alertsEnabled?: boolean | undefined }) {
    const set: Partial<typeof savedSearches.$inferInsert> = {};
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.alertsEnabled !== undefined) set.alertsEnabled = patch.alertsEnabled;
    const [r] = await this.db.update(savedSearches).set(set).where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId))).returning();
    if (!r) throw Errors.notFound('Saved search');
    return r;
  }

  async deleteSaved(userId: string, id: string) {
    await this.db.delete(savedSearches).where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)));
  }

  /** Job: push "N new cars match" for each alert-enabled saved search. */
  async runSavedSearchMatching() {
    const all = await this.db.select().from(savedSearches).where(eq(savedSearches.alertsEnabled, true));
    let notified = 0;
    const engine = await this.engine();
    for (const s of all) {
      const q = searchQuerySchema.safeParse(s.query);
      if (!q.success) continue;
      const since = s.lastNotifiedAt ?? s.createdAt;
      const ids = await engine.newSince(q.data, since);
      if (!ids.length) continue;
      await this.notifications.notify({ template: 'saved_search_alert', locale: 'ar', vars: { count: ids.length, name: s.name ?? '' }, channels: ['push'], userId: s.userId, data: { url: `agarha://saved/${s.id}` }, related: { type: 'saved_search', id: s.id } });
      await this.db.update(savedSearches).set({ lastNotifiedAt: new Date() }).where(eq(savedSearches.id, s.id));
      notified++;
    }
    return { checked: all.length, notified };
  }

  async favoritesCards(userId: string) {
    const ids = await this.listings.favorites(userId);
    const cards: ListingCard[] = [];
    for (const id of ids) {
      const [row] = await this.db.select({ card: searchDocuments.card }).from(searchDocuments).where(eq(searchDocuments.listingId, id));
      if (row) cards.push(row.card as ListingCard);
    }
    return { items: cards, unavailableIds: ids.filter((id) => !cards.some((c) => c.id === id)) };
  }
}
