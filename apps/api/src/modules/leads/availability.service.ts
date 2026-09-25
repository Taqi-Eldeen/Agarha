import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, lt } from 'drizzle-orm';
import { randomRef } from '../../common/crypto';
import { Errors } from '../../common/errors';
import { DB, type Database } from '../../db/db';
import { availabilityRequests } from '../../db/schema/leads';
import { EventBus } from '../../infra/events';
import { RateLimiter } from '../../infra/redis/rate-limiter';
import { CatalogService } from '../catalog';
import { DealersService } from '../dealers';
import { ListingsService } from '../listings';
import { NotificationsService } from '../notifications';

const EXPIRE_AFTER_MS = 72 * 3_600_000;

/**
 * Phase 6 "request availability for dates". The dealer answers yes/no; nothing is booked or paid.
 * The customer then contacts the dealer directly as usual.
 */
@Injectable()
export class AvailabilityService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly limiter: RateLimiter,
    private readonly listings: ListingsService,
    private readonly dealers: DealersService,
    private readonly catalog: CatalogService,
    private readonly notifications: NotificationsService,
    private readonly events: EventBus,
  ) {}

  async create(userId: string, input: { listingId: string; startDate: string; endDate: string; note?: string | undefined; locale: 'ar' | 'en' }) {
    await this.limiter.hit({ name: 'availability:user', key: userId, max: 10, windowSeconds: 86_400 });
    const today = new Date().toISOString().slice(0, 10);
    if (input.startDate < today || input.endDate < input.startDate) throw Errors.badRequest('validation_failed', 'Check the dates');
    const listing = await this.listings.publicOne(input.listingId);
    if (!listing) throw Errors.notFound('Listing');
    const refCode = `AR-${randomRef(4)}`;
    const [r] = await this.db.insert(availabilityRequests).values({ refCode, listingId: listing.id, dealerId: listing.dealerId, userId, startDate: input.startDate, endDate: input.endDate, note: input.note ?? null }).returning();
    const c = await this.dealers.contacts(listing.dealerId);
    const m = await this.catalog.model(listing.carModelId);
    await this.notifications.notify({ template: 'availability_request', locale: 'ar', vars: { car: `${m?.makeNameAr ?? ''} ${m?.nameAr ?? ''} ${listing.year}`.trim(), from: input.startDate, to: input.endDate, ref: refCode }, channels: ['whatsapp'], whatsappTo: c.whatsapp, related: { type: 'availability_request', id: r!.id } });
    await this.events.publish('availability_request.created', { requestId: r!.id, dealerId: listing.dealerId, listingId: listing.id });
    return r!;
  }

  mine(userId: string) {
    return this.db.select().from(availabilityRequests).where(eq(availabilityRequests.userId, userId)).orderBy(desc(availabilityRequests.createdAt)).limit(50);
  }

  forDealer(dealerId: string) {
    return this.db.select().from(availabilityRequests).where(eq(availabilityRequests.dealerId, dealerId)).orderBy(desc(availabilityRequests.createdAt)).limit(100);
  }

  async answer(dealerId: string, id: string, available: boolean) {
    const [r] = await this.db.select().from(availabilityRequests).where(and(eq(availabilityRequests.id, id), eq(availabilityRequests.dealerId, dealerId)));
    if (!r) throw Errors.notFound('Request');
    if (r.status !== 'sent') throw Errors.conflict('Already answered');
    await this.db.update(availabilityRequests).set({ status: available ? 'available' : 'unavailable', respondedAt: new Date() }).where(eq(availabilityRequests.id, id));
    const listing = (await this.listings.load([r.listingId]))[0];
    const m = listing ? await this.catalog.model(listing.carModelId) : null;
    const c = await this.dealers.contacts(dealerId);
    await this.notifications.notify({ template: available ? 'availability_answer_yes' : 'availability_answer_no', locale: 'ar', vars: { dealer: c.nameAr, car: `${m?.makeNameAr ?? ''} ${m?.nameAr ?? ''}`.trim() }, channels: ['push'], userId: r.userId, data: { url: `agarha://cars/${r.listingId}` }, related: { type: 'availability_request', id } });
    await this.events.publish('availability_request.answered', { requestId: id, userId: r.userId, available });
    return { id, status: available ? 'available' : 'unavailable' };
  }

  async expireOld(now = new Date()) {
    const r = await this.db.update(availabilityRequests).set({ status: 'expired' }).where(and(eq(availabilityRequests.status, 'sent'), lt(availabilityRequests.createdAt, new Date(now.getTime() - EXPIRE_AFTER_MS)))).returning({ id: availabilityRequests.id });
    return r.length;
  }
}
