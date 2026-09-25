import { AUTO_HIDE_AFTER_MS, freshnessOf, freshnessScore, type Role } from '@agarha/schemas';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { and, asc, desc, eq, gt, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { Errors } from '../../common/errors';
import { decodeCursor, encodeCursor } from '../../common/pagination';
import { DB, type Database } from '../../db/db';
import { favorites, listingPhotos, listingPrices, listings } from '../../db/schema/listings';
import { EventBus } from '../../infra/events';
import { Queues } from '../../infra/queue/queues';
import { STORAGE, type Storage } from '../../infra/storage/storage';
import { PrivacyRegistry } from '../../infra/privacy';
import { AuditService } from '../admin';
import { BillingService } from '../billing';
import { CatalogService } from '../catalog';
import { DealersService } from '../dealers';
import { MAX_PHOTOS_PER_LISTING, PHOTO_FORMATS, PHOTO_WIDTHS, RejectedMedia, processListingPhoto } from '../media';
import { NotificationsService } from '../notifications';
import type { CreateListing } from './listings.schemas';

/** New dealers' first N listings are pre-moderated; afterwards they go live and are reviewed after the fact. */
export const PRE_MODERATION_COUNT = 5;

export interface Actor {
  userId: string;
  role: Role;
  dealerId?: string;
  ip?: string | undefined;
}

type ListingRow = typeof listings.$inferSelect;
type PriceRow = typeof listingPrices.$inferSelect;
type PhotoRow = typeof listingPhotos.$inferSelect;

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

@Injectable()
export class ListingsService implements OnModuleInit {
  private readonly logger = new Logger('Listings');
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(STORAGE) private readonly storage: Storage,
    private readonly queues: Queues,
    private readonly events: EventBus,
    private readonly audit: AuditService,
    private readonly catalog: CatalogService,
    private readonly dealers: DealersService,
    private readonly billing: BillingService,
    private readonly notifications: NotificationsService,
    private readonly privacy: PrivacyRegistry,
  ) {}

  onModuleInit() {
    // Kill switch: suspending a dealer hides every live listing at once; lifting it restores them.
    this.events.on('dealer.suspended', async ({ dealerId }) => {
      const r = await this.db.update(listings).set({ status: 'hidden', hiddenReason: 'dealer_suspended' }).where(and(eq(listings.dealerId, dealerId), eq(listings.status, 'live'))).returning({ id: listings.id });
      await this.changed(...r.map((x) => x.id));
    });
    this.events.on('dealer.unsuspended', async ({ dealerId }) => {
      const r = await this.db.update(listings).set({ status: 'live', hiddenReason: null }).where(and(eq(listings.dealerId, dealerId), eq(listings.status, 'hidden'), eq(listings.hiddenReason, 'dealer_suspended'))).returning({ id: listings.id });
      await this.changed(...r.map((x) => x.id));
    });
    this.events.on('featured.activated', async ({ listingId, endsAt }) => {
      await this.db.update(listings).set({ featuredUntil: new Date(endsAt) }).where(eq(listings.id, listingId));
      await this.changed(listingId);
    });
    this.privacy.register({
      name: 'favorites',
      export: (userId) => this.db.select({ listingId: favorites.listingId, createdAt: favorites.createdAt }).from(favorites).where(eq(favorites.userId, userId)),
      erase: async (userId) => {
        await this.db.delete(favorites).where(eq(favorites.userId, userId));
      },
    });
  }

  // ---- read helpers -----------------------------------------------------
  photoUrls(p: PhotoRow) {
    const variants = p.variants;
    return {
      id: p.id,
      position: p.position,
      status: p.status,
      width: p.width,
      height: p.height,
      blurhash: p.blurhash,
      urls: variants
        ? Object.fromEntries(PHOTO_FORMATS.map((f) => [f, Object.fromEntries(PHOTO_WIDTHS.map((w) => [w, this.storage.publicUrl(variants[f][String(w) as '320'])]))]))
        : null,
    };
  }

  async load(ids: string[]) {
    if (!ids.length) return [];
    const rows = await this.db.select({ l: listings, p: listingPrices }).from(listings).innerJoin(listingPrices, eq(listingPrices.listingId, listings.id)).where(inArray(listings.id, ids));
    const photos = await this.db.select().from(listingPhotos).where(and(inArray(listingPhotos.listingId, ids), eq(listingPhotos.status, 'ready'))).orderBy(asc(listingPhotos.position));
    const byListing = new Map<string, PhotoRow[]>();
    for (const p of photos) byListing.set(p.listingId, [...(byListing.get(p.listingId) ?? []), p]);
    const order = new Map(ids.map((id, i) => [id, i]));
    return rows
      .map((r) => this.dto(r.l, r.p, byListing.get(r.l.id) ?? []))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }

  dto(l: ListingRow, p: PriceRow, photos: PhotoRow[]) {
    const now = new Date();
    return {
      id: l.id,
      slug: l.slug,
      dealerId: l.dealerId,
      branchId: l.branchId,
      carModelId: l.carModelId,
      trimId: l.trimId,
      status: l.status,
      available: l.available,
      lastConfirmedAt: l.lastConfirmedAt.toISOString(),
      freshness: freshnessOf(l.lastConfirmedAt, now),
      freshnessScore: Number(freshnessScore(l.lastConfirmedAt, now).toFixed(3)),
      transmission: l.transmission,
      seats: l.seats,
      fuel: l.fuel,
      year: l.year,
      color: l.color,
      driverOption: l.driverOption,
      minAge: l.minAge,
      requiredDocs: l.requiredDocs,
      kmLimitPerDay: l.kmLimitPerDay,
      deliveryOptions: l.deliveryOptions,
      airportPickup: l.airportPickup,
      descriptionAr: l.descriptionAr,
      descriptionEn: l.descriptionEn,
      featured: !!l.featuredUntil && l.featuredUntil > now,
      featuredUntil: l.featuredUntil?.toISOString() ?? null,
      hiddenReason: l.hiddenReason,
      publishedAt: l.publishedAt?.toISOString() ?? null,
      updatedAt: l.updatedAt.toISOString(),
      prices: { day: p.priceDayEgp, week: p.priceWeekEgp, month: p.priceMonthEgp, deposit: p.depositEgp },
      photos: photos.map((ph) => this.photoUrls(ph)),
    };
  }
  async one(id: string) {
    const [r] = await this.load([id]);
    if (!r) throw Errors.notFound('Listing');
    return r;
  }

  private async changed(...ids: string[]) {
    for (const listingId of ids) await this.events.publish('listing.changed', { listingId });
  }

  private async owned(dealerId: string, id: string) {
    const [l] = await this.db.select().from(listings).where(and(eq(listings.id, id), eq(listings.dealerId, dealerId)));
    if (!l) throw Errors.notFound('Listing');
    return l;
  }

  // ---- dealer fleet -----------------------------------------------------
  async fleet(dealerId: string, q: { status?: string | undefined; cursor?: string | undefined; limit: number }) {
    const c = decodeCursor<{ t: string; id: string }>(q.cursor);
    const rows = await this.db
      .select({ id: listings.id, updatedAt: listings.updatedAt })
      .from(listings)
      .where(and(eq(listings.dealerId, dealerId), q.status ? eq(listings.status, q.status as never) : ne(listings.status, 'archived'), c ? or(lt(listings.updatedAt, new Date(c.t)), and(eq(listings.updatedAt, new Date(c.t)), lt(listings.id, c.id))) : undefined))
      .orderBy(desc(listings.updatedAt), desc(listings.id))
      .limit(q.limit + 1);
    const page = rows.slice(0, q.limit);
    const items = await this.load(page.map((r) => r.id));
    const models = new Map<string, Awaited<ReturnType<CatalogService['model']>>>();
    for (const i of items) if (!models.has(i.carModelId)) models.set(i.carModelId, await this.catalog.model(i.carModelId));
    const last = page.at(-1);
    return {
      items: items.map((i) => ({ ...i, model: models.get(i.carModelId) })),
      nextCursor: rows.length > q.limit && last ? encodeCursor({ t: last.updatedAt.toISOString(), id: last.id }) : null,
      counts: await this.counts(dealerId),
    };
  }

  async counts(dealerId: string) {
    const r = await this.db.select({ status: listings.status, n: sql<number>`count(*)::int` }).from(listings).where(eq(listings.dealerId, dealerId)).groupBy(listings.status);
    return Object.fromEntries(r.map((x) => [x.status, x.n])) as Record<string, number>;
  }

  async create(dealerId: string, input: CreateListing, actor: Actor) {
    await this.dealers.branch(dealerId, input.branchId);
    const model = await this.catalog.model(input.carModelId);
    if (!model) throw Errors.badRequest('validation_failed', 'Unknown car model');
    const id = await this.db.transaction(async (tx) => {
      const [l] = await tx
        .insert(listings)
        .values({
          dealerId,
          branchId: input.branchId,
          carModelId: input.carModelId,
          trimId: input.trimId ?? null,
          slug: slugify(`${model.makeNameEn}-${model.nameEn}-${input.year}`),
          status: 'draft',
          transmission: input.transmission,
          seats: input.seats,
          fuel: input.fuel,
          year: input.year,
          color: input.color,
          driverOption: input.driverOption,
          minAge: input.minAge,
          requiredDocs: input.requiredDocs,
          kmLimitPerDay: input.kmLimitPerDay,
          deliveryOptions: input.deliveryOptions,
          airportPickup: input.airportPickup,
          descriptionAr: input.descriptionAr ?? null,
          descriptionEn: input.descriptionEn ?? null,
        })
        .returning({ id: listings.id });
      await tx.insert(listingPrices).values({ listingId: l!.id, priceDayEgp: input.priceDayEgp, priceWeekEgp: input.priceWeekEgp ?? null, priceMonthEgp: input.priceMonthEgp ?? null, depositEgp: input.depositEgp });
      await this.audit.record({ actorUserId: actor.userId, actorRole: actor.role, action: 'listing.create', targetType: 'listing', targetId: l!.id, dealerId }, tx);
      return l!.id;
    });
    return this.one(id);
  }

  async update(dealerId: string, id: string, input: CreateListing, actor: Actor) {
    const l = await this.owned(dealerId, id);
    if (l.status === 'archived') throw Errors.conflict('Archived listings cannot be edited');
    await this.dealers.branch(dealerId, input.branchId);
    const model = await this.catalog.model(input.carModelId);
    if (!model) throw Errors.badRequest('validation_failed', 'Unknown car model');
    await this.db.transaction(async (tx) => {
      await tx
        .update(listings)
        .set({
          branchId: input.branchId,
          carModelId: input.carModelId,
          trimId: input.trimId ?? null,
          slug: slugify(`${model.makeNameEn}-${model.nameEn}-${input.year}`),
          transmission: input.transmission,
          seats: input.seats,
          fuel: input.fuel,
          year: input.year,
          color: input.color,
          driverOption: input.driverOption,
          minAge: input.minAge,
          requiredDocs: input.requiredDocs,
          kmLimitPerDay: input.kmLimitPerDay,
          deliveryOptions: input.deliveryOptions,
          airportPickup: input.airportPickup,
          descriptionAr: input.descriptionAr ?? null,
          descriptionEn: input.descriptionEn ?? null,
          // A material edit to a live listing puts it back into the post-moderation queue.
          reviewedAt: null,
          lastConfirmedAt: new Date(),
        })
        .where(eq(listings.id, id));
      await tx.update(listingPrices).set({ priceDayEgp: input.priceDayEgp, priceWeekEgp: input.priceWeekEgp ?? null, priceMonthEgp: input.priceMonthEgp ?? null, depositEgp: input.depositEgp }).where(eq(listingPrices.listingId, id));
      await this.audit.record({ actorUserId: actor.userId, actorRole: actor.role, action: 'listing.update', targetType: 'listing', targetId: id, dealerId }, tx);
    });
    await this.changed(id);
    return this.one(id);
  }

  /** Draft/paused -> live (or pending for new dealers). Enforces verification, photos and plan limits. */
  async publish(dealerId: string, id: string, actor: Actor) {
    const l = await this.owned(dealerId, id);
    if (!['draft', 'paused', 'hidden'].includes(l.status)) throw Errors.conflict(`Cannot publish a ${l.status} listing`);
    if (l.status === 'hidden' && l.hiddenReason !== 'stale') throw Errors.conflict('This listing was hidden by moderation');
    const d = await this.dealers.get(dealerId);
    if (!this.dealers.isPublic(d)) throw Errors.conflict('Your business must be verified before cars go live');
    const [{ n: photos } = { n: 0 }] = await this.db.select({ n: sql<number>`count(*)::int` }).from(listingPhotos).where(and(eq(listingPhotos.listingId, id), eq(listingPhotos.status, 'ready')));
    if (photos < 1) throw Errors.conflict('Add at least one photo');
    const limits = await this.billing.limits(dealerId);
    if (limits.maxLiveListings !== null) {
      const live = (await this.counts(dealerId)).live ?? 0;
      if (live >= limits.maxLiveListings) throw Errors.conflict('Your plan does not allow more live cars', { maxLiveListings: limits.maxLiveListings });
    }
    const [{ n: approved } = { n: 0 }] = await this.db.select({ n: sql<number>`count(*)::int` }).from(listings).where(and(eq(listings.dealerId, dealerId), sql`${listings.reviewedAt} IS NOT NULL`));
    const alreadyApproved = l.reviewedAt !== null || l.publishedAt !== null;
    const status = approved >= PRE_MODERATION_COUNT || alreadyApproved ? 'live' : 'pending';
    await this.db.update(listings).set({ status, hiddenReason: null, lastConfirmedAt: new Date(), ...(status === 'live' && !l.publishedAt ? { publishedAt: new Date() } : {}) }).where(eq(listings.id, id));
    await this.audit.record({ actorUserId: actor.userId, actorRole: actor.role, action: status === 'live' ? 'listing.publish' : 'listing.submit', targetType: 'listing', targetId: id, dealerId });
    if (status === 'live') await this.events.publish('listing.published', { listingId: id, dealerId });
    await this.changed(id);
    return this.one(id);
  }

  async setStatus(dealerId: string, id: string, status: 'paused' | 'archived', actor: Actor) {
    const l = await this.owned(dealerId, id);
    if (l.status === 'archived') throw Errors.conflict('Already archived');
    await this.db.update(listings).set({ status }).where(eq(listings.id, id));
    await this.audit.record({ actorUserId: actor.userId, actorRole: actor.role, action: `listing.${status === 'paused' ? 'pause' : 'archive'}`, targetType: 'listing', targetId: id, dealerId });
    await this.changed(id);
    return this.one(id);
  }

  /** One-tap switch. Any change counts as a confirmation (resets freshness). */
  async setAvailability(dealerId: string, id: string, available: boolean, actor: Actor) {
    await this.owned(dealerId, id);
    const [r] = await this.db.update(listings).set({ available, lastConfirmedAt: new Date() }).where(eq(listings.id, id)).returning({ available: listings.available, lastConfirmedAt: listings.lastConfirmedAt });
    await this.audit.record({ actorUserId: actor.userId, actorRole: actor.role, action: 'listing.availability', targetType: 'listing', targetId: id, dealerId, metadata: { available } });
    await this.changed(id);
    return { id, available: r!.available, lastConfirmedAt: r!.lastConfirmedAt.toISOString(), freshness: freshnessOf(r!.lastConfirmedAt) };
  }

  /** Bulk "confirm all": refreshes every live/paused car and brings back stale-hidden ones. */
  async confirmAll(dealerId: string, actor: Actor) {
    const now = new Date();
    const confirmed = await this.db.update(listings).set({ lastConfirmedAt: now }).where(and(eq(listings.dealerId, dealerId), inArray(listings.status, ['live', 'paused', 'pending']))).returning({ id: listings.id });
    const restored = await this.db.update(listings).set({ status: 'live', hiddenReason: null, lastConfirmedAt: now }).where(and(eq(listings.dealerId, dealerId), eq(listings.status, 'hidden'), eq(listings.hiddenReason, 'stale'))).returning({ id: listings.id });
    await this.audit.record({ actorUserId: actor.userId, actorRole: actor.role, action: 'listing.confirm_all', targetType: 'dealer', targetId: dealerId, dealerId, metadata: { confirmed: confirmed.length, restored: restored.length } });
    await this.changed(...confirmed.map((r) => r.id), ...restored.map((r) => r.id));
    return { confirmed: confirmed.length + restored.length, restored: restored.length, confirmedAt: now.toISOString() };
  }

  async branchHasListings(branchId: string) {
    const [r] = await this.db.select({ n: sql<number>`count(*)::int` }).from(listings).where(and(eq(listings.branchId, branchId), ne(listings.status, 'archived')));
    return (r?.n ?? 0) > 0;
  }

  // ---- photos -----------------------------------------------------------
  async createPhotoUpload(dealerId: string, listingId: string, input: { mimeType: string; sizeBytes: number }) {
    await this.owned(dealerId, listingId);
    const existing = await this.db.select({ position: listingPhotos.position }).from(listingPhotos).where(and(eq(listingPhotos.listingId, listingId), ne(listingPhotos.status, 'rejected')));
    if (existing.length >= MAX_PHOTOS_PER_LISTING) throw Errors.conflict(`A car can have at most ${MAX_PHOTOS_PER_LISTING} photos`);
    const used = new Set(existing.map((e) => e.position));
    const position = [...Array(MAX_PHOTOS_PER_LISTING).keys()].find((p) => !used.has(p))!;
    await this.db.delete(listingPhotos).where(and(eq(listingPhotos.listingId, listingId), eq(listingPhotos.position, position), eq(listingPhotos.status, 'rejected')));
    const photoId = randomUUID();
    const key = `listings/${listingId}/${photoId}/upload`;
    await this.db.insert(listingPhotos).values({ id: photoId, listingId, position, status: 'pending_upload', storageKey: key });
    // Uploads land in the private bucket; only processed, EXIF-free variants are public.
    return { photoId, position, upload: await this.storage.presignPut('private', key, input.mimeType, input.sizeBytes) };
  }

  async completePhoto(dealerId: string, listingId: string, photoId: string) {
    await this.owned(dealerId, listingId);
    const r = await this.db.update(listingPhotos).set({ status: 'processing' }).where(and(eq(listingPhotos.id, photoId), eq(listingPhotos.listingId, listingId), eq(listingPhotos.status, 'pending_upload'))).returning({ id: listingPhotos.id });
    if (!r.length) throw Errors.notFound('Photo');
    await this.queues.add('media', { kind: 'listing_photo', photoId }, { jobId: `photo-${photoId}` });
    return { photoId, status: 'processing' };
  }

  /** Worker: validate, strip EXIF/GPS, WebP/AVIF at 320/640/1280, blurhash, then publish variants. */
  async processPhoto(photoId: string) {
    const [p] = await this.db.select().from(listingPhotos).where(eq(listingPhotos.id, photoId));
    if (!p || p.status === 'ready') return;
    try {
      const out = await processListingPhoto(await this.storage.get('private', p.storageKey));
      const prefix = `listings/${p.listingId}/${p.id}`;
      const variants = { webp: {}, avif: {} } as Record<'webp' | 'avif', Record<'320' | '640' | '1280', string>>;
      for (const v of out.variants) {
        const key = `${prefix}/${v.width}.${v.format}`;
        await this.storage.put('public', key, v.body, `image/${v.format}`);
        variants[v.format][String(v.width) as '320'] = key;
      }
      await this.storage.delete('private', p.storageKey).catch(() => undefined);
      await this.db.update(listingPhotos).set({ status: 'ready', width: out.width, height: out.height, blurhash: out.blurhash, variants, storageKey: `${prefix}/1280.webp` }).where(eq(listingPhotos.id, photoId));
      await this.changed(p.listingId);
    } catch (err) {
      if (!(err instanceof RejectedMedia) && (err as { code?: string }).code !== 'ENOENT' && (err as { name?: string }).name !== 'NoSuchKey') throw err;
      this.logger.warn({ photoId, reason: (err as Error).message }, 'photo rejected');
      await this.db.update(listingPhotos).set({ status: 'rejected' }).where(eq(listingPhotos.id, photoId));
    }
  }

  async photos(dealerId: string, listingId: string) {
    await this.owned(dealerId, listingId);
    const rows = await this.db.select().from(listingPhotos).where(eq(listingPhotos.listingId, listingId)).orderBy(asc(listingPhotos.position));
    return rows.map((p) => this.photoUrls(p));
  }

  async reorderPhotos(dealerId: string, listingId: string, photoIds: string[]) {
    await this.owned(dealerId, listingId);
    const rows = await this.db.select({ id: listingPhotos.id }).from(listingPhotos).where(eq(listingPhotos.listingId, listingId));
    const known = new Set(rows.map((r) => r.id));
    if (photoIds.some((id) => !known.has(id))) throw Errors.badRequest('validation_failed', 'Unknown photo');
    await this.db.transaction(async (tx) => {
      // (listing_id, position) is a DEFERRABLE unique constraint (migration 0004), so swaps are fine in one transaction.
      for (const [i, id] of photoIds.entries()) await tx.update(listingPhotos).set({ position: i }).where(eq(listingPhotos.id, id));
    });
    await this.changed(listingId);
    return this.photos(dealerId, listingId);
  }

  async deletePhoto(dealerId: string, listingId: string, photoId: string) {
    await this.owned(dealerId, listingId);
    const [p] = await this.db.delete(listingPhotos).where(and(eq(listingPhotos.id, photoId), eq(listingPhotos.listingId, listingId))).returning();
    if (!p) throw Errors.notFound('Photo');
    await this.changed(listingId);
    if (p.variants) for (const f of PHOTO_FORMATS) for (const w of PHOTO_WIDTHS) await this.storage.delete('public', p.variants[f][String(w) as '320']).catch(() => undefined);
  }

  // ---- moderation -------------------------------------------------------
  async adminQueue(q: { queue: string; dealerId?: string | undefined; cursor?: string | undefined; limit: number }) {
    const filter =
      q.queue === 'pending' ? eq(listings.status, 'pending') : q.queue === 'unreviewed' ? and(eq(listings.status, 'live'), isNull(listings.reviewedAt)) : q.queue === 'hidden' ? eq(listings.status, 'hidden') : undefined;
    const c = decodeCursor<{ t: string; id: string }>(q.cursor);
    const rows = await this.db
      .select({ id: listings.id, updatedAt: listings.updatedAt })
      .from(listings)
      .where(and(filter, q.dealerId ? eq(listings.dealerId, q.dealerId) : undefined, c ? or(gt(listings.updatedAt, new Date(c.t)), and(eq(listings.updatedAt, new Date(c.t)), gt(listings.id, c.id))) : undefined))
      .orderBy(asc(listings.updatedAt), asc(listings.id))
      .limit(q.limit + 1);
    const page = rows.slice(0, q.limit);
    const last = page.at(-1);
    return { items: await this.load(page.map((r) => r.id)), nextCursor: rows.length > q.limit && last ? encodeCursor({ t: last.updatedAt.toISOString(), id: last.id }) : null };
  }

  async moderate(id: string, d: { decision: 'approve' } | { decision: 'reject' | 'hide'; reason: string }, actor: Actor) {
    const [l] = await this.db.select().from(listings).where(eq(listings.id, id));
    if (!l) throw Errors.notFound('Listing');
    if (d.decision === 'approve') {
      const goLive = l.status === 'pending';
      await this.db.update(listings).set({ reviewedAt: new Date(), ...(goLive ? { status: 'live', publishedAt: l.publishedAt ?? new Date(), lastConfirmedAt: new Date() } : {}) }).where(eq(listings.id, id));
      if (goLive) await this.events.publish('listing.published', { listingId: id, dealerId: l.dealerId });
    } else {
      await this.db.update(listings).set({ status: d.decision === 'reject' ? 'draft' : 'hidden', hiddenReason: `moderation: ${d.reason}`, reviewedAt: new Date() }).where(eq(listings.id, id));
      await this.events.publish('listing.hidden', { listingId: id, dealerId: l.dealerId, reason: d.reason });
    }
    await this.audit.record({ actorUserId: actor.userId, actorRole: actor.role, action: `listing.moderate.${d.decision}`, targetType: 'listing', targetId: id, dealerId: l.dealerId, ...('reason' in d ? { metadata: { reason: d.reason } } : {}) });
    await this.changed(id);
    return this.one(id);
  }

  async hideForReport(id: string, reason: string, actor: Actor) {
    return this.moderate(id, { decision: 'hide', reason }, actor);
  }

  // ---- public -----------------------------------------------------------
  /** Live listing whose dealer is verified and not suspended, else null. */
  async publicOne(id: string) {
    const [l] = await this.db.select({ id: listings.id, status: listings.status, dealerId: listings.dealerId }).from(listings).where(eq(listings.id, id));
    if (!l || l.status !== 'live') return null;
    const d = await this.dealers.get(l.dealerId);
    if (!this.dealers.isPublic(d)) return null;
    return this.one(id);
  }

  /** Ids of every listing currently live (full reindex). */
  async liveIds() {
    return (await this.db.select({ id: listings.id }).from(listings).where(eq(listings.status, 'live'))).map((r) => r.id);
  }

  async freshnessStats() {
    const [r] = await this.db
      .select({
        live: sql<number>`count(*) FILTER (WHERE ${listings.status} = 'live')::int`,
        fresh7: sql<number>`count(*) FILTER (WHERE ${listings.status} = 'live' AND ${listings.lastConfirmedAt} > now() - interval '7 days')::int`,
        pending: sql<number>`count(*) FILTER (WHERE ${listings.status} = 'pending')::int`,
        staleHidden: sql<number>`count(*) FILTER (WHERE ${listings.status} = 'hidden' AND ${listings.hiddenReason} = 'stale')::int`,
      })
      .from(listings);
    return { live: r?.live ?? 0, confirmedWithin7Days: r?.fresh7 ?? 0, freshPercent: r && r.live ? Math.round((r.fresh7 / r.live) * 1000) / 10 : null, pending: r?.pending ?? 0, staleHidden: r?.staleHidden ?? 0 };
  }

  async publicIdsForSitemap() {
    return this.db.select({ id: listings.id, slug: listings.slug, updatedAt: listings.updatedAt }).from(listings).where(eq(listings.status, 'live'));
  }

  /** Listings a dealer still has to confirm (for the weekly nudge). */
  async needsConfirmation(olderThanMs: number) {
    const cutoff = new Date(Date.now() - olderThanMs);
    return this.db.select({ dealerId: listings.dealerId, n: sql<number>`count(*)::int` }).from(listings).where(and(inArray(listings.status, ['live', 'hidden']), lt(listings.lastConfirmedAt, cutoff), or(ne(listings.status, 'hidden'), eq(listings.hiddenReason, 'stale')))).groupBy(listings.dealerId);
  }

  // ---- jobs -------------------------------------------------------------
  /** Hourly. Freshness "decay" is computed at query time from last_confirmed_at; this enforces the 14-day auto-hide. */
  async runFreshness(now = new Date()) {
    const cutoff = new Date(now.getTime() - AUTO_HIDE_AFTER_MS);
    const hidden = await this.db.update(listings).set({ status: 'hidden', hiddenReason: 'stale' }).where(and(eq(listings.status, 'live'), lt(listings.lastConfirmedAt, cutoff))).returning({ id: listings.id, dealerId: listings.dealerId, carModelId: listings.carModelId, year: listings.year });
    for (const h of hidden) {
      const contacts = await this.dealers.contacts(h.dealerId);
      const model = await this.catalog.model(h.carModelId);
      await this.notifications.notify({ template: 'listing_hidden', locale: 'ar', vars: { car: `${model?.makeNameAr ?? ''} ${model?.nameAr ?? ''} ${h.year}`.trim() }, channels: ['whatsapp'], whatsappTo: contacts.whatsapp, related: { type: 'listing', id: h.id } });
      await this.events.publish('listing.hidden', { listingId: h.id, dealerId: h.dealerId, reason: 'stale' });
      await this.changed(h.id);
    }
    return { hidden: hidden.length };
  }

  /** Weekly "still available?" nudge to each dealer with cars not confirmed in the last 5 days. */
  async runNudges() {
    const rows = await this.needsConfirmation(5 * 86_400_000);
    for (const r of rows) {
      const c = await this.dealers.contacts(r.dealerId);
      await this.notifications.notify({ template: 'availability_nudge', locale: 'ar', vars: { count: r.n }, channels: ['whatsapp'], whatsappTo: c.whatsapp, related: { type: 'dealer', id: r.dealerId } });
    }
    return { nudged: rows.length };
  }

  // ---- favorites --------------------------------------------------------
  async favorites(userId: string) {
    const rows = await this.db.select({ id: favorites.listingId }).from(favorites).where(eq(favorites.userId, userId)).orderBy(desc(favorites.createdAt));
    return rows.map((r) => r.id);
  }
  async addFavorite(userId: string, listingId: string) {
    if (!(await this.publicOne(listingId))) throw Errors.notFound('Listing');
    await this.db.insert(favorites).values({ userId, listingId }).onConflictDoNothing();
  }
  async removeFavorite(userId: string, listingId: string) {
    await this.db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.listingId, listingId)));
  }
}
