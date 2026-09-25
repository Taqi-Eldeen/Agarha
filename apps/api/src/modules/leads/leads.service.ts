import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { and, desc, eq, gt, inArray, lt, or, sql } from 'drizzle-orm';
import { hmac, randomRef } from '../../common/crypto';
import { Errors } from '../../common/errors';
import { decodeCursor, encodeCursor } from '../../common/pagination';
import { ENV, type Env } from '../../config/env';
import { DB, type Database } from '../../db/db';
import { availabilityRequests, leads } from '../../db/schema/leads';
import { EventBus } from '../../infra/events';
import { PrivacyRegistry } from '../../infra/privacy';
import { RateLimiter } from '../../infra/redis/rate-limiter';
import { AuditService } from '../admin';
import { CatalogService } from '../catalog';
import { DealersService } from '../dealers';
import { ListingsService } from '../listings';
import { NotificationsService } from '../notifications';
import { leadUrl } from './lead-link';

export const REVIEW_PROMPT_DELAY_MS = 24 * 3_600_000;
export const LEAD_RETENTION_MONTHS = 24;

@Injectable()
export class LeadsService implements OnModuleInit {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly limiter: RateLimiter,
    private readonly listings: ListingsService,
    private readonly dealers: DealersService,
    private readonly catalog: CatalogService,
    private readonly notifications: NotificationsService,
    private readonly events: EventBus,
    private readonly audit: AuditService,
    private readonly privacy: PrivacyRegistry,
  ) {}

  onModuleInit() {
    this.privacy.register({
      name: 'leads',
      export: (userId) =>
        this.db
          .select({
            refCode: leads.refCode,
            listingId: leads.listingId,
            channel: leads.channel,
            createdAt: leads.createdAt,
          })
          .from(leads)
          .where(eq(leads.userId, userId)),
      // Leads are the dealer's business record too: we unlink the person, the lead stays (until retention).
      erase: async (userId) => {
        await this.db
          .update(leads)
          .set({ userId: null, ipHash: null })
          .where(eq(leads.userId, userId));
        await this.db.delete(availabilityRequests).where(eq(availabilityRequests.userId, userId));
      },
    });
  }

  private async uniqueRef(table: typeof leads | typeof availabilityRequests): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const ref = `AG-${randomRef(4)}`;
      const [hit] = await this.db
        .select({ id: table.id })
        .from(table)
        .where(eq(table.refCode, ref));
      if (!hit) return ref;
    }
    return `AG-${randomRef(6)}`;
  }

  /** POST /v1/leads: rate-limited, returns the wa.me / tel: deep link with the reference code. */
  async create(
    input: { listingId: string; channel: 'whatsapp' | 'call'; locale: 'ar' | 'en' },
    ctx: { userId: string | null; ip: string | undefined },
  ) {
    const ipHash = ctx.ip ? hmac(this.env.HASH_PEPPER, `ip:${ctx.ip}`) : 'unknown';
    await this.limiter.hit(
      { name: 'lead:ip', key: ipHash, max: 30, windowSeconds: 3600 },
      { name: 'lead:ip-listing', key: `${ipHash}:${input.listingId}`, max: 5, windowSeconds: 3600 },
    );
    const listing = await this.listings.publicOne(input.listingId);
    if (!listing) throw Errors.notFound('Listing');
    const contacts = await this.dealers.contacts(listing.dealerId);
    const branch = await this.dealers.branch(listing.dealerId, listing.branchId);
    const model = await this.catalog.model(listing.carModelId);
    const refCode = await this.uniqueRef(leads);
    const [lead] = await this.db
      .insert(leads)
      .values({
        refCode,
        listingId: listing.id,
        dealerId: listing.dealerId,
        userId: ctx.userId,
        channel: input.channel,
        locale: input.locale,
        ipHash,
      })
      .returning();
    const carAr = `${model?.makeNameAr ?? ''} ${model?.nameAr ?? ''}`.trim();
    const carEn = `${model?.makeNameEn ?? ''} ${model?.nameEn ?? ''}`.trim();
    const url = leadUrl({
      channel: input.channel,
      locale: input.locale,
      dealerWhatsapp: branch.whatsapp ?? contacts.whatsapp,
      dealerPhone: branch.phone ?? contacts.phone,
      carAr,
      carEn,
      year: listing.year,
      refCode,
    });

    await this.events.publish('lead.created', {
      leadId: lead!.id,
      listingId: listing.id,
      dealerId: listing.dealerId,
      userId: ctx.userId,
      channel: input.channel,
      refCode,
      locale: input.locale,
    });
    // Dealer alert (WhatsApp template) — in Arabic, the dealer's working language.
    await this.notifications.notify({
      template: 'lead_alert',
      locale: 'ar',
      vars: {
        channel: input.channel === 'whatsapp' ? 'واتساب' : 'مكالمة',
        car: `${carAr} ${listing.year}`,
        ref: refCode,
      },
      channels: ['whatsapp'],
      whatsappTo: contacts.whatsapp,
      related: { type: 'lead', id: lead!.id },
    });
    // Review prompt 24h later for signed-in customers (Q7).
    if (ctx.userId) {
      await this.notifications.notify({
        template: 'review_prompt',
        locale: input.locale,
        vars: {
          dealer: input.locale === 'ar' ? contacts.nameAr : contacts.nameEn,
          car: input.locale === 'ar' ? carAr : carEn,
        },
        channels: ['push'],
        userId: ctx.userId,
        data: {
          leadId: lead!.id,
          dealerId: listing.dealerId,
          url: `agarha://reviews/new?leadId=${lead!.id}`,
        },
        related: { type: 'lead', id: lead!.id },
        delayMs: REVIEW_PROMPT_DELAY_MS,
      });
    }
    return { leadId: lead!.id, refCode, channel: input.channel, url };
  }

  async dealerLeads(dealerId: string, q: { cursor?: string | undefined; limit: number }) {
    const c = decodeCursor<{ t: string; id: string }>(q.cursor);
    const rows = await this.db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.dealerId, dealerId),
          c
            ? or(
                lt(leads.createdAt, new Date(c.t)),
                and(eq(leads.createdAt, new Date(c.t)), lt(leads.id, c.id)),
              )
            : undefined,
        ),
      )
      .orderBy(desc(leads.createdAt), desc(leads.id))
      .limit(q.limit + 1);
    const page = rows.slice(0, q.limit);
    const cars = new Map(
      (await this.listings.load([...new Set(page.map((r) => r.listingId))])).map((l) => [l.id, l]),
    );
    const models = new Map<string, Awaited<ReturnType<CatalogService['model']>>>();
    for (const l of cars.values())
      if (!models.has(l.carModelId))
        models.set(l.carModelId, await this.catalog.model(l.carModelId));
    const last = page.at(-1);
    return {
      items: page.map((r) => {
        const l = cars.get(r.listingId);
        const m = l ? models.get(l.carModelId) : null;
        return {
          id: r.id,
          refCode: r.refCode,
          channel: r.channel,
          outcome: r.outcome,
          outcomeAt: r.outcomeAt,
          createdAt: r.createdAt,
          signedIn: r.userId !== null,
          listing: l
            ? {
                id: l.id,
                year: l.year,
                nameAr: `${m?.makeNameAr ?? ''} ${m?.nameAr ?? ''}`.trim(),
                nameEn: `${m?.makeNameEn ?? ''} ${m?.nameEn ?? ''}`.trim(),
              }
            : null,
        };
      }),
      nextCursor:
        rows.length > q.limit && last
          ? encodeCursor({ t: last.createdAt.toISOString(), id: last.id })
          : null,
    };
  }

  /** Dealer marks the outcome, including "came from Agarha" (risk #4, attribution). */
  async setOutcome(
    dealerId: string,
    id: string,
    outcome: 'from_agarha' | 'rented' | 'not_rented' | 'no_reply',
    actor: { userId: string; role: 'dealer_owner' | 'dealer_staff' },
  ) {
    const r = await this.db
      .update(leads)
      .set({ outcome, outcomeAt: new Date() })
      .where(and(eq(leads.id, id), eq(leads.dealerId, dealerId)))
      .returning({ id: leads.id });
    if (!r.length) throw Errors.notFound('Lead');
    await this.audit.record({
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'lead.outcome',
      targetType: 'lead',
      targetId: id,
      dealerId,
      metadata: { outcome },
    });
    return { id, outcome };
  }

  async findByRef(dealerId: string, refCode: string) {
    const [r] = await this.db
      .select()
      .from(leads)
      .where(and(eq(leads.dealerId, dealerId), eq(leads.refCode, refCode.toUpperCase())));
    if (!r) throw Errors.notFound('Lead');
    return r;
  }

  /** Used by reviews: a lead owned by the user, for that dealer, at least 24h old. */
  async eligibleForReview(userId: string, leadId: string) {
    const [r] = await this.db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.userId, userId)));
    if (!r) return null;
    return { ...r, oldEnough: Date.now() - r.createdAt.getTime() >= REVIEW_PROMPT_DELAY_MS };
  }

  async userLeads(userId: string) {
    return this.db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.userId, userId),
          lt(leads.createdAt, new Date(Date.now() - REVIEW_PROMPT_DELAY_MS)),
        ),
      )
      .orderBy(desc(leads.createdAt))
      .limit(50);
  }

  /**
   * Response rate over the last 90 days: share of leads the dealer acted on (marked any outcome)
   * plus availability requests answered within 24h. Shown on the dealer profile (trust).
   */
  async responseRate(dealerId: string): Promise<number | null> {
    const since = new Date(Date.now() - 90 * 86_400_000);
    const [l] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        acted: sql<number>`count(*) FILTER (WHERE ${leads.outcome} <> 'unknown')::int`,
      })
      .from(leads)
      .where(and(eq(leads.dealerId, dealerId), gt(leads.createdAt, since)));
    const [a] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        answered: sql<number>`count(*) FILTER (WHERE ${availabilityRequests.respondedAt} IS NOT NULL AND ${availabilityRequests.respondedAt} - ${availabilityRequests.createdAt} <= interval '24 hours')::int`,
      })
      .from(availabilityRequests)
      .where(
        and(eq(availabilityRequests.dealerId, dealerId), gt(availabilityRequests.createdAt, since)),
      );
    const total = (l?.total ?? 0) + (a?.total ?? 0);
    if (total < 5) return null; // not enough data to show a rate
    return Math.round((((l?.acted ?? 0) + (a?.answered ?? 0)) / total) * 100) / 100;
  }

  async countsByListing(listingIds: string[], since: Date) {
    if (!listingIds.length) return [];
    return this.db
      .select({ listingId: leads.listingId, channel: leads.channel, n: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(inArray(leads.listingId, listingIds), gt(leads.createdAt, since)))
      .groupBy(leads.listingId, leads.channel);
  }

  /** Retention: leads are deleted after 24 months. */
  async purgeExpired(now = new Date()) {
    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - LEAD_RETENTION_MONTHS);
    // reviews.lead_id is ON DELETE SET NULL: published reviews outlive the lead they came from.
    const r = await this.db
      .delete(leads)
      .where(lt(leads.createdAt, cutoff))
      .returning({ id: leads.id });
    return r.length;
  }
}
