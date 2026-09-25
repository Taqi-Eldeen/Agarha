import { ROLES, egyptMobileSchema, type Role } from '@agarha/schemas';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { AuthContext } from '../../common/auth/auth-context';
import { AdminAuth, CurrentAuth } from '../../common/auth/guards';
import { TokenService } from '../../common/auth/token.service';
import { Errors } from '../../common/errors';
import { decodeCursor, encodeCursor } from '../../common/pagination';
import { ZodBody, ZodPipe, ZodQuery } from '../../common/zod';
import { DB, type Database } from '../../db/db';
import { auditLog } from '../../db/schema/admin';
import { Queues, QUEUE } from '../../infra/queue/queues';
import { MapsService } from '../../infra/maps';
import { AnalyticsService } from '../analytics';
import { DealersService } from '../dealers';
import { UsersService } from '../identity';
import { AccountService } from '../identity';
import { ListingsService } from '../listings';
import { NotificationsService } from '../notifications';
import { AuditService } from './audit.service';

const auditQuery = z.object({
  targetType: z.string().max(40).optional(),
  targetId: z.string().max(80).optional(),
  dealerId: z.uuid().optional(),
  actorUserId: z.uuid().optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
const staffSchema = z.object({
  email: z.email(),
  displayName: z.string().trim().min(2).max(60),
  roles: z.array(z.enum(['admin', 'moderator', 'support'])).min(1),
  phone: egyptMobileSchema,
});
const reasonSchema = z.object({ reason: z.string().trim().min(3).max(300) });

@ApiTags('admin')
@Controller('admin')
export class AdminConsoleController {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly users: UsersService,
    private readonly account: AccountService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly dealers: DealersService,
    private readonly listings: ListingsService,
    private readonly analytics: AnalyticsService,
    private readonly notifications: NotificationsService,
    private readonly queues: Queues,
    private readonly maps: MapsService,
  ) {}

  private role(a: AuthContext): Role {
    return a.roles.includes('admin') ? 'admin' : (a.roles[0] ?? 'support');
  }

  @Get('users')
  @AdminAuth('admin', 'support')
  async lookup(
    @CurrentAuth() a: AuthContext,
    @Query('phone') phoneRaw?: string,
    @Query('id') id?: string,
  ) {
    let user = null;
    if (id) user = await this.users.findById(id);
    else if (phoneRaw) {
      const phone = egyptMobileSchema.safeParse(phoneRaw);
      if (!phone.success)
        throw Errors.badRequest('validation_failed', 'Enter an Egyptian mobile number');
      user = await this.users.findByPhone(phone.data);
    }
    if (!user) return { user: null };
    await this.audit.record({
      actorUserId: a.userId,
      actorRole: this.role(a),
      action: 'user.lookup',
      targetType: 'user',
      targetId: user.id,
    });
    const memberships = await this.dealers.memberships(user.id);
    return {
      user: {
        id: user.id,
        phone: user.phoneE164,
        displayName: user.displayName,
        status: user.status,
        locale: user.locale,
        createdAt: user.createdAt,
        lastSignInAt: user.lastSignInAt,
        roles: await this.users.platformRoles(user.id),
      },
      memberships,
    };
  }

  @Post('users/:id/block')
  @HttpCode(200)
  @AdminAuth('admin', 'support')
  @ZodBody(reasonSchema)
  async block(
    @CurrentAuth() a: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(reasonSchema)) b: z.output<typeof reasonSchema>,
  ) {
    await this.users.setStatus(id, 'blocked');
    await this.tokens.revokeAllForUser(id, 'blocked');
    await this.audit.record({
      actorUserId: a.userId,
      actorRole: this.role(a),
      action: 'user.block',
      targetType: 'user',
      targetId: id,
      metadata: { reason: b.reason },
    });
    return { id, status: 'blocked' };
  }

  @Post('users/:id/unblock')
  @HttpCode(200)
  @AdminAuth('admin', 'support')
  async unblock(@CurrentAuth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.users.setStatus(id, 'active');
    await this.audit.record({
      actorUserId: a.userId,
      actorRole: this.role(a),
      action: 'user.unblock',
      targetType: 'user',
      targetId: id,
    });
    return { id, status: 'active' };
  }

  /** PDPL requests handled by support (e.g. by email): export or delete on the user's behalf. */
  @Post('users/:id/export')
  @HttpCode(200)
  @AdminAuth('admin', 'support')
  async export(@CurrentAuth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.audit.record({
      actorUserId: a.userId,
      actorRole: this.role(a),
      action: 'user.export',
      targetType: 'user',
      targetId: id,
    });
    return this.account.export(id);
  }

  @Post('users/:id/delete')
  @HttpCode(200)
  @AdminAuth('admin')
  @ZodBody(reasonSchema)
  async delete(
    @CurrentAuth() a: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(reasonSchema)) b: z.output<typeof reasonSchema>,
  ) {
    await this.account.delete(id);
    await this.audit.record({
      actorUserId: a.userId,
      actorRole: this.role(a),
      action: 'user.delete',
      targetType: 'user',
      targetId: id,
      metadata: { reason: b.reason },
    });
    return { id, status: 'deleted' };
  }

  @Post('staff')
  @AdminAuth('admin')
  @ZodBody(staffSchema)
  async provisionStaff(
    @CurrentAuth() a: AuthContext,
    @Body(new ZodPipe(staffSchema)) b: z.output<typeof staffSchema>,
  ) {
    const user = await this.users.findOrCreateByPhone(b.phone, 'ar');
    await this.users.setDisplayName(user.id, b.displayName);
    await this.users.grantRoles(user.id, b.roles);
    await this.users.linkIdentity(
      user.id,
      'google_workspace',
      `pending:${b.email.toLowerCase()}`,
      b.email.toLowerCase(),
    );
    await this.audit.record({
      actorUserId: a.userId,
      actorRole: 'admin',
      action: 'staff.provision',
      targetType: 'user',
      targetId: user.id,
      metadata: { roles: b.roles, email: b.email },
    });
    return { userId: user.id, roles: b.roles };
  }

  @Get('audit')
  @AdminAuth('admin')
  @ZodQuery(auditQuery)
  async auditLog(@Query(new ZodPipe(auditQuery)) q: z.output<typeof auditQuery>) {
    const c = decodeCursor<{ id: number }>(q.cursor);
    const rows = await this.db
      .select()
      .from(auditLog)
      .where(
        and(
          q.targetType ? eq(auditLog.targetType, q.targetType) : undefined,
          q.targetId ? eq(auditLog.targetId, q.targetId) : undefined,
          q.dealerId ? eq(auditLog.dealerId, q.dealerId) : undefined,
          q.actorUserId ? eq(auditLog.actorUserId, q.actorUserId) : undefined,
          c ? lt(auditLog.id, c.id) : undefined,
        ),
      )
      .orderBy(desc(auditLog.id))
      .limit(q.limit + 1);
    const items = rows.slice(0, q.limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor: rows.length > q.limit && last ? encodeCursor({ id: last.id }) : null,
    };
  }

  /** Business dashboard (section 10): live listings, freshness %, leads per day, response rate, ops health. */
  @Get('metrics')
  @AdminAuth('admin', 'moderator', 'support')
  async metrics() {
    const fresh = await this.listings.freshnessStats();
    const daily = await this.analytics.platformDaily(14);
    const dealers = await this.dealers.adminList({ status: 'pending_review', limit: 100 });
    const otp = await this.db.execute<{ sent: number; failed: number }>(
      sql`SELECT count(*) FILTER (WHERE status = 'sent')::int AS sent, count(*) FILTER (WHERE status = 'failed')::int AS failed FROM notification_deliveries WHERE template = 'otp' AND created_at > now() - interval '24 hours'`,
    );
    const o = otp.rows[0] ?? { sent: 0, failed: 0 };
    const backlog: Record<string, number> = {};
    for (const name of Object.values(QUEUE)) {
      const counts = await this.queues.get(name).getJobCounts('waiting', 'delayed', 'failed');
      backlog[name] = counts.waiting ?? 0;
    }
    return {
      listings: fresh,
      dealers: {
        pendingReview: dealers.items.length,
        verified: (await this.dealers.allPublicIds()).length,
      },
      daily,
      otp24h: {
        ...o,
        failureRate:
          o.sent + o.failed ? Math.round((o.failed / (o.sent + o.failed)) * 1000) / 10 : 0,
      },
      queues: backlog,
      mapsCallsThisMonth: await this.maps.monthlyCalls(),
      roles: ROLES,
    };
  }
}
