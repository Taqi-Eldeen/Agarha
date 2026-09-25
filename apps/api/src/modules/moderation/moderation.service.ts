import type { ReportReason } from '@agarha/schemas';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { Errors } from '../../common/errors';
import { DB, type Database } from '../../db/db';
import { reports } from '../../db/schema/moderation';
import { PrivacyRegistry } from '../../infra/privacy';
import { RateLimiter } from '../../infra/redis/rate-limiter';
import { AuditService } from '../admin';
import { DealersService } from '../dealers';
import { ListingsService } from '../listings';

@Injectable()
export class ModerationService implements OnModuleInit {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly listings: ListingsService,
    private readonly dealers: DealersService,
    private readonly limiter: RateLimiter,
    private readonly audit: AuditService,
    private readonly privacy: PrivacyRegistry,
  ) {}

  onModuleInit() {
    this.privacy.register({
      name: 'reports',
      export: (userId) => this.db.select({ listingId: reports.listingId, reason: reports.reason, details: reports.details, status: reports.status, createdAt: reports.createdAt }).from(reports).where(eq(reports.userId, userId)),
      erase: async (userId) => {
        await this.db.update(reports).set({ userId: null }).where(eq(reports.userId, userId));
      },
    });
  }

  async report(userId: string, input: { listingId: string; reason: ReportReason; details?: string | undefined }) {
    await this.limiter.hit({ name: 'report:user', key: userId, max: 10, windowSeconds: 86_400 });
    const l = (await this.listings.load([input.listingId]))[0];
    if (!l) throw Errors.notFound('Listing');
    const [dup] = await this.db.select({ id: reports.id }).from(reports).where(and(eq(reports.userId, userId), eq(reports.listingId, input.listingId), eq(reports.status, 'open')));
    if (dup) return { id: dup.id, status: 'open' as const };
    const [r] = await this.db.insert(reports).values({ userId, listingId: l.id, dealerId: l.dealerId, reason: input.reason, details: input.details ?? null }).returning({ id: reports.id, status: reports.status });
    return r!;
  }

  queue(status: 'open' | 'actioned' | 'dismissed' = 'open') {
    // Scam reports first: they're the most harmful (risk #2).
    return this.db.select().from(reports).where(eq(reports.status, status)).orderBy(desc(eq(reports.reason, 'scam_or_deposit_request')), reports.createdAt).limit(200);
  }

  async resolve(id: string, action: 'dismiss' | 'hide_listing' | 'suspend_dealer', note: string, actor: { userId: string; role: 'admin' | 'moderator' }) {
    const [r] = await this.db.select().from(reports).where(eq(reports.id, id));
    if (!r) throw Errors.notFound('Report');
    if (action === 'hide_listing' && r.listingId) await this.listings.hideForReport(r.listingId, note, actor);
    if (action === 'suspend_dealer') await this.dealers.suspend(r.dealerId, note, actor);
    await this.db.update(reports).set({ status: action === 'dismiss' ? 'dismissed' : 'actioned', handledBy: actor.userId, handledAt: new Date() }).where(eq(reports.id, id));
    await this.audit.record({ actorUserId: actor.userId, actorRole: actor.role, action: `report.${action}`, targetType: 'report', targetId: id, dealerId: r.dealerId, metadata: { note } });
    return { id, action };
  }

  async countsForDealer(dealerId: string) {
    return this.db.select().from(reports).where(eq(reports.dealerId, dealerId)).orderBy(desc(reports.createdAt)).limit(50);
  }
}
