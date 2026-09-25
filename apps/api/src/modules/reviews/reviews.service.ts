import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { and, desc, eq, lt, or, sql } from 'drizzle-orm';
import { Errors } from '../../common/errors';
import { decodeCursor, encodeCursor } from '../../common/pagination';
import { DB, type Database } from '../../db/db';
import { reviews } from '../../db/schema/reviews';
import { EventBus } from '../../infra/events';
import { PrivacyRegistry } from '../../infra/privacy';
import { RateLimiter } from '../../infra/redis/rate-limiter';
import { AuditService } from '../admin';
import { LeadsService } from '../leads';

/** Q7: only an account that sent a tracked lead to the dealer, ≥ 24h after the lead. Moderated. */
@Injectable()
export class ReviewsService implements OnModuleInit {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly leads: LeadsService,
    private readonly limiter: RateLimiter,
    private readonly audit: AuditService,
    private readonly events: EventBus,
    private readonly privacy: PrivacyRegistry,
  ) {}

  onModuleInit() {
    this.privacy.register({
      name: 'reviews',
      export: (userId) => this.db.select({ id: reviews.id, dealerId: reviews.dealerId, rating: reviews.rating, body: reviews.body, status: reviews.status, createdAt: reviews.createdAt }).from(reviews).where(eq(reviews.userId, userId)),
      // Published reviews stay (they're about the dealer), but are no longer linked to the person.
      erase: async (userId) => {
        await this.db.update(reviews).set({ userId: null }).where(eq(reviews.userId, userId));
      },
    });
  }

  async create(userId: string, input: { leadId: string; rating: number; body?: string | undefined }) {
    await this.limiter.hit({ name: 'review:user', key: userId, max: 5, windowSeconds: 86_400 });
    const lead = await this.leads.eligibleForReview(userId, input.leadId);
    if (!lead) throw Errors.forbidden('You can review a dealer only after contacting them through Agarha');
    if (!lead.oldEnough) throw Errors.conflict('You can write a review 24 hours after contacting the dealer');
    const [existing] = await this.db.select({ id: reviews.id }).from(reviews).where(eq(reviews.leadId, lead.id));
    if (existing) throw Errors.conflict('You already reviewed this enquiry');
    // One review per user per dealer per 30 days, even with several leads.
    const [recent] = await this.db.select({ id: reviews.id }).from(reviews).where(and(eq(reviews.userId, userId), eq(reviews.dealerId, lead.dealerId), sql`${reviews.createdAt} > now() - interval '30 days'`));
    if (recent) throw Errors.conflict('You reviewed this dealer recently');
    const [r] = await this.db.insert(reviews).values({ dealerId: lead.dealerId, leadId: lead.id, userId, rating: input.rating, body: input.body ?? null, status: 'pending' }).returning();
    return r!;
  }

  async reviewable(userId: string) {
    const ls = await this.leads.userLeads(userId);
    const done = new Set((await this.db.select({ leadId: reviews.leadId }).from(reviews).where(eq(reviews.userId, userId))).map((r) => r.leadId));
    return ls.filter((l) => !done.has(l.id)).map((l) => ({ leadId: l.id, dealerId: l.dealerId, listingId: l.listingId, createdAt: l.createdAt }));
  }

  async publicForDealer(dealerId: string, q: { cursor?: string | undefined; limit: number }) {
    const c = decodeCursor<{ t: string; id: string }>(q.cursor);
    const rows = await this.db
      .select({ id: reviews.id, rating: reviews.rating, body: reviews.body, dealerReply: reviews.dealerReply, dealerRepliedAt: reviews.dealerRepliedAt, createdAt: reviews.createdAt })
      .from(reviews)
      .where(and(eq(reviews.dealerId, dealerId), eq(reviews.status, 'published'), c ? or(lt(reviews.createdAt, new Date(c.t)), and(eq(reviews.createdAt, new Date(c.t)), lt(reviews.id, c.id))) : undefined))
      .orderBy(desc(reviews.createdAt), desc(reviews.id))
      .limit(q.limit + 1);
    const items = rows.slice(0, q.limit);
    const last = items.at(-1);
    return { items, nextCursor: rows.length > q.limit && last ? encodeCursor({ t: last.createdAt.toISOString(), id: last.id }) : null };
  }

  async summary(dealerId: string) {
    const [s] = await this.db.select({ count: sql<number>`count(*)::int`, avg: sql<number | null>`round(avg(${reviews.rating})::numeric, 1)::float` }).from(reviews).where(and(eq(reviews.dealerId, dealerId), eq(reviews.status, 'published')));
    return { count: s?.count ?? 0, average: s?.avg ?? null };
  }

  async summaries(dealerIds: string[]) {
    if (!dealerIds.length) return new Map<string, { count: number; average: number | null }>();
    const rows = await this.db
      .select({ dealerId: reviews.dealerId, count: sql<number>`count(*)::int`, avg: sql<number | null>`round(avg(${reviews.rating})::numeric, 1)::float` })
      .from(reviews)
      .where(and(sql`${reviews.dealerId} = ANY(${dealerIds}::uuid[])`, eq(reviews.status, 'published')))
      .groupBy(reviews.dealerId);
    return new Map(rows.map((r) => [r.dealerId, { count: r.count, average: r.avg }]));
  }

  dealerReviews(dealerId: string) {
    return this.db.select().from(reviews).where(and(eq(reviews.dealerId, dealerId), eq(reviews.status, 'published'))).orderBy(desc(reviews.createdAt)).limit(100);
  }

  async reply(dealerId: string, id: string, text: string, actor: { userId: string; role: 'dealer_owner' | 'dealer_staff' }) {
    const r = await this.db.update(reviews).set({ dealerReply: text, dealerRepliedAt: new Date() }).where(and(eq(reviews.id, id), eq(reviews.dealerId, dealerId), eq(reviews.status, 'published'))).returning();
    if (!r.length) throw Errors.notFound('Review');
    await this.audit.record({ actorUserId: actor.userId, actorRole: actor.role, action: 'review.reply', targetType: 'review', targetId: id, dealerId });
    return r[0];
  }

  moderationQueue() {
    return this.db.select().from(reviews).where(eq(reviews.status, 'pending')).orderBy(reviews.createdAt).limit(100);
  }

  async moderate(id: string, approve: boolean, actor: { userId: string; role: 'admin' | 'moderator' }, reason?: string) {
    const [r] = await this.db.update(reviews).set({ status: approve ? 'published' : 'rejected', moderatedBy: actor.userId, moderatedAt: new Date() }).where(and(eq(reviews.id, id), eq(reviews.status, 'pending'))).returning();
    if (!r) throw Errors.notFound('Pending review');
    await this.audit.record({ actorUserId: actor.userId, actorRole: actor.role, action: approve ? 'review.approve' : 'review.reject', targetType: 'review', targetId: id, dealerId: r.dealerId, ...(reason ? { metadata: { reason } } : {}) });
    if (approve) await this.events.publish('review.published', { reviewId: id, dealerId: r.dealerId });
    return r;
  }
}
