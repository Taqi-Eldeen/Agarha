import { VERIFICATION_DOC_TYPES } from '@agarha/schemas';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { AuthContext } from '../../common/auth/auth-context';
import { AdminAuth, Auth, CurrentAuth, CurrentDealer } from '../../common/auth/guards';
import { Idempotent } from '../../common/idempotency';
import { Client, type ClientInfo } from '../../common/request';
import { ZodBody, ZodPipe } from '../../common/zod';
import { VerificationService } from './verification.service';

const uploadSchema = z.object({
  type: z.enum(VERIFICATION_DOC_TYPES),
  mimeType: z.enum(['application/pdf', 'image/jpeg']),
  sizeBytes: z.number().int().min(1).max(10 * 1024 * 1024),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
const reviewSchema = z.discriminatedUnion('approve', [z.object({ approve: z.literal(true) }), z.object({ approve: z.literal(false), reason: z.string().trim().min(3).max(300) })]);

type Dealer = { dealerId: string; userId: string; role: 'dealer_owner' | 'dealer_staff' };

@ApiTags('dealer')
@Controller('dealer/documents')
export class DealerDocumentsController {
  constructor(private readonly verification: VerificationService) {}

  @Get()
  @Auth('dealer', 'dealer_owner')
  async list(@CurrentDealer() d: Dealer) {
    return { items: await this.verification.list(d.dealerId), checklist: await this.verification.checklist(d.dealerId) };
  }

  @Post('uploads')
  @Auth('dealer', 'dealer_owner')
  @Idempotent()
  @ZodBody(uploadSchema)
  create(@CurrentDealer() d: Dealer, @Body(new ZodPipe(uploadSchema)) body: z.output<typeof uploadSchema>) {
    return this.verification.createUpload(d.dealerId, body, { userId: d.userId, role: d.role });
  }

  @Post(':id/complete')
  @HttpCode(200)
  @Auth('dealer', 'dealer_owner')
  complete(@CurrentDealer() d: Dealer, @Param('id', ParseUUIDPipe) id: string) {
    return this.verification.complete(d.dealerId, id);
  }
}

@ApiTags('admin')
@Controller('admin')
export class AdminDocumentsController {
  constructor(private readonly verification: VerificationService) {}

  @Get('dealers/:dealerId/documents')
  @AdminAuth('admin', 'moderator')
  async list(@Param('dealerId', ParseUUIDPipe) dealerId: string) {
    return { items: await this.verification.list(dealerId), checklist: await this.verification.checklist(dealerId) };
  }

  @Post('documents/:id/view')
  @HttpCode(200)
  @AdminAuth('admin', 'moderator')
  view(@CurrentAuth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Client() c: ClientInfo) {
    return this.verification.signedUrl(id, { userId: a.userId, role: a.roles[0] ?? 'moderator', ip: c.ip, requestId: c.requestId });
  }

  @Post('documents/:id/review')
  @HttpCode(200)
  @AdminAuth('admin', 'moderator')
  @ZodBody(reviewSchema)
  review(@CurrentAuth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(reviewSchema)) body: z.output<typeof reviewSchema>) {
    return this.verification.review(id, body, { userId: a.userId, role: a.roles[0] ?? 'moderator' });
  }
}
