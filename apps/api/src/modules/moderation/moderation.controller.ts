import { reportInputSchema } from '@agarha/schemas';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { AuthContext } from '../../common/auth/auth-context';
import { AdminAuth, Auth, CurrentAuth } from '../../common/auth/guards';
import { Idempotent } from '../../common/idempotency';
import { ZodBody, ZodPipe } from '../../common/zod';
import { ModerationService } from './moderation.service';

const reportSchema = reportInputSchema;
const resolveSchema = z.object({
  action: z.enum(['dismiss', 'hide_listing', 'suspend_dealer']),
  note: z.string().trim().min(3).max(500),
});

@ApiTags('reports')
@Controller()
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Post('reports')
  @Auth('customer')
  @Idempotent()
  @ZodBody(reportSchema)
  report(
    @CurrentAuth() a: AuthContext,
    @Body(new ZodPipe(reportSchema)) b: z.output<typeof reportSchema>,
  ) {
    return this.moderation.report(a.userId, b);
  }

  @Get('admin/reports')
  @AdminAuth('admin', 'moderator')
  async queue(@Query('status') status?: 'open' | 'actioned' | 'dismissed') {
    return { items: await this.moderation.queue(status ?? 'open') };
  }

  @Post('admin/reports/:id/resolve')
  @HttpCode(200)
  @AdminAuth('admin', 'moderator')
  @ZodBody(resolveSchema)
  resolve(
    @CurrentAuth() a: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(resolveSchema)) b: z.output<typeof resolveSchema>,
  ) {
    return this.moderation.resolve(id, b.action, b.note, {
      userId: a.userId,
      role: a.roles.includes('admin') ? 'admin' : 'moderator',
    });
  }
}
