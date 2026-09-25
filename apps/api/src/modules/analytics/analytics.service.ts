import { freshnessScore } from '@agarha/schemas';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import { hmac } from '../../common/crypto';
import { ENV, type Env } from '../../config/env';
import { DB, type Database } from '../../db/db';
import { listingDailyStats } from '../../db/schema/analytics';
import { EventBus } from '../../infra/events';
import { FlagsService } from '../../infra/flags';
import { REDIS } from '../../infra/redis/redis';
import { CatalogService } from '../catalog';
import { ListingsService } from '../listings';

const cairoDay = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(d);

@Injectable()
export class AnalyticsService implements OnModuleInit {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(ENV) private readonly env: Env,
    private readonly events: EventBus,
    private readonly flags: FlagsService,
    private readonly listings: ListingsService,
    private readonly catalog: CatalogService,
  ) {}

  onModuleInit() {
    this.events.on('lead.created', async (e) => {
      await this.bump(e.listingId, e.dealerId, e.channel === 'whatsapp' ? 'whatsappContacts' : 'callContacts');
      this.flags.capture({ event: 'lead_created', distinctId: e.userId ?? `anon:${e.leadId}`, properties: { channel: e.channel, listing_id: e.listingId, dealer_id: e.dealerId, locale: e.locale } });
    });
  }

  private async bump(listingId: string, dealerId: string, col: 'views' | 'whatsappContacts' | 'callContacts') {
    const column = listingDailyStats[col];
    await this.db
      .insert(listingDailyStats)
      .values({ listingId, dealerId, day: cairoDay(), [col]: 1 })
      .onConflictDoUpdate({ target: [listingDailyStats.listingId, listingDailyStats.day], set: { [col]: sql`${column} + 1` } });
  }

  /** One view per visitor per listing per day (visitor = hashed IP + UA). */
  async recordView(listingId: string, dealerId: string, visitor: string) {
    const key = `view:${listingId}:${cairoDay()}:${hmac(this.env.HASH_PEPPER, visitor).slice(0, 16)}`;
    if (await this.redis.set(key, '1', 'EX', 90_000, 'NX')) await this.bump(listingId, dealerId, 'views');
  }

  /** Dealer stats: views, contacts, conversion per car, freshness score. */
  async dealerStats(dealerId: string, days: number) {
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await this.db
      .select({ listingId: listingDailyStats.listingId, views: sql<number>`sum(${listingDailyStats.views})::int`, whatsapp: sql<number>`sum(${listingDailyStats.whatsappContacts})::int`, calls: sql<number>`sum(${listingDailyStats.callContacts})::int` })
      .from(listingDailyStats)
      .where(and(eq(listingDailyStats.dealerId, dealerId), gte(listingDailyStats.day, cairoDay(since))))
      .groupBy(listingDailyStats.listingId);
    const daily = await this.db
      .select({ day: listingDailyStats.day, views: sql<number>`sum(${listingDailyStats.views})::int`, contacts: sql<number>`sum(${listingDailyStats.whatsappContacts} + ${listingDailyStats.callContacts})::int` })
      .from(listingDailyStats)
      .where(and(eq(listingDailyStats.dealerId, dealerId), gte(listingDailyStats.day, cairoDay(since))))
      .groupBy(listingDailyStats.day)
      .orderBy(listingDailyStats.day);
    const fleet = await this.listings.fleet(dealerId, { limit: 100 });
    const byId = new Map(rows.map((r) => [r.listingId, r]));
    const cars = fleet.items.map((l) => {
      const s = byId.get(l.id);
      const contacts = (s?.whatsapp ?? 0) + (s?.calls ?? 0);
      return {
        listingId: l.id,
        nameAr: `${l.model?.makeNameAr ?? ''} ${l.model?.nameAr ?? ''}`.trim(),
        nameEn: `${l.model?.makeNameEn ?? ''} ${l.model?.nameEn ?? ''}`.trim(),
        year: l.year,
        status: l.status,
        views: s?.views ?? 0,
        whatsapp: s?.whatsapp ?? 0,
        calls: s?.calls ?? 0,
        conversion: s?.views ? Math.round((contacts / s.views) * 1000) / 10 : null,
        freshnessScore: Math.round(freshnessScore(new Date(l.lastConfirmedAt)) * 100),
        lastConfirmedAt: l.lastConfirmedAt,
      };
    });
    const live = cars.filter((c) => c.status === 'live');
    const totals = cars.reduce((t, c) => ({ views: t.views + c.views, whatsapp: t.whatsapp + c.whatsapp, calls: t.calls + c.calls }), { views: 0, whatsapp: 0, calls: 0 });
    return {
      days,
      totals: { ...totals, conversion: totals.views ? Math.round(((totals.whatsapp + totals.calls) / totals.views) * 1000) / 10 : null },
      freshnessScore: live.length ? Math.round(live.reduce((s, c) => s + c.freshnessScore, 0) / live.length) : null,
      daily,
      cars,
    };
  }

  async viewsByListing(ids: string[], since: Date) {
    if (!ids.length) return [];
    return this.db.select({ listingId: listingDailyStats.listingId, views: sql<number>`sum(${listingDailyStats.views})::int` }).from(listingDailyStats).where(and(inArray(listingDailyStats.listingId, ids), gte(listingDailyStats.day, cairoDay(since)))).groupBy(listingDailyStats.listingId);
  }

  /** Platform totals per day for the admin business dashboard. */
  async platformDaily(days: number) {
    return this.db
      .select({ day: listingDailyStats.day, views: sql<number>`sum(${listingDailyStats.views})::int`, leads: sql<number>`sum(${listingDailyStats.whatsappContacts} + ${listingDailyStats.callContacts})::int` })
      .from(listingDailyStats)
      .where(gte(listingDailyStats.day, cairoDay(new Date(Date.now() - days * 86_400_000))))
      .groupBy(listingDailyStats.day)
      .orderBy(listingDailyStats.day);
  }

}
