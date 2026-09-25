import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { AuthContext } from '../../common/auth/auth-context';
import { AdminAuth, Auth, CurrentAuth, CurrentDealer } from '../../common/auth/guards';
import { Errors } from '../../common/errors';
import { Idempotent } from '../../common/idempotency';
import { ZodBody, ZodPipe } from '../../common/zod';
import { FLAGS, FlagsService } from '../../infra/flags';
import { ReviewsService } from './reviews.service';

type Dealer = { dealerId: string; userId: string; role: 'dealer_owner' | 'dealer_staff' };
const createSchema = z.object({ leadId: z.uuid(), rating: z.number().int().min(1).max(5), body: z.string().trim().min(3).max(1000).optional() });
const replySchema = z.object({ text: z.string().trim().min(2).max(1000) });
const moderateSchema = z.object({ approve: z.boolean(), reason: z.string().trim().max(300).optional() });

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly flags: FlagsService,
  ) {}

  private async gate() {
    if (!(await this.flags.isEnabled(FLAGS.reviews))) throw Errors.notFound('Route');
  }

  @Post('reviews')
  @Auth('customer')
  @Idempotent()
  @ZodBody(createSchema)
  async create(@CurrentAuth() a: AuthContext, @Body(new ZodPipe(createSchema)) b: z.output<typeof createSchema>) {
    await this.gate();
    return this.reviews.create(a.userId, b);
  }

  @Get('me/reviewable')
  @Auth('customer')
  async reviewable(@CurrentAuth() a: AuthContext) {
    return { items: await this.reviews.reviewable(a.userId) };
  }

  @Get('dealer/reviews')
  @Auth('dealer', 'dealer_owner', 'dealer_staff')
  async mine(@CurrentDealer() d: Dealer) {
    return { items: await this.reviews.dealerReviews(d.dealerId), summary: await this.reviews.summary(d.dealerId) };
  }

  @Post('dealer/reviews/:id/reply')
  @HttpCode(200)
  @Auth('dealer', 'dealer_owner', 'dealer_staff')
  @ZodBody(replySchema)
  reply(@CurrentDealer() d: Dealer, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(replySchema)) b: z.output<typeof replySchema>) {
    return this.reviews.reply(d.dealerId, id, b.text, d);
  }

  @Get('admin/reviews')
  @AdminAuth('admin', 'moderator')
  async queue() {
    return { items: await this.reviews.moderationQueue() };
  }

  @Post('admin/reviews/:id/moderate')
  @HttpCode(200)
  @AdminAuth('admin', 'moderator')
  @ZodBody(moderateSchema)
  moderate(@CurrentAuth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(moderateSchema)) b: z.output<typeof moderateSchema>) {
    return this.reviews.moderate(id, b.approve, { userId: a.userId, role: a.roles.includes('admin') ? 'admin' : 'moderator' }, b.reason);
  }
}
