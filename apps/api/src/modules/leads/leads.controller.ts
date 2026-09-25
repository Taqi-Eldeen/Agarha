import { LEAD_CHANNELS } from '@agarha/schemas';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { AuthContext } from '../../common/auth/auth-context';
import { Auth, CurrentAuth, CurrentDealer, MaybeAuth, OptionalAuth } from '../../common/auth/guards';
import { Errors } from '../../common/errors';
import { Idempotent } from '../../common/idempotency';
import { Client, type ClientInfo } from '../../common/request';
import { ZodBody, ZodPipe, ZodQuery } from '../../common/zod';
import { FLAGS, FlagsService } from '../../infra/flags';
import { AvailabilityService } from './availability.service';
import { LeadsService } from './leads.service';

type Dealer = { dealerId: string; userId: string; role: 'dealer_owner' | 'dealer_staff' };
const leadSchema = z.object({ listingId: z.uuid(), channel: z.enum(LEAD_CHANNELS), locale: z.enum(['ar', 'en']).default('ar') });
const leadResponseSchema = z.object({ leadId: z.uuid(), refCode: z.string(), channel: z.enum(LEAD_CHANNELS), url: z.string() });
const outcomeSchema = z.object({ outcome: z.enum(['from_agarha', 'rented', 'not_rented', 'no_reply']) });
const pageSchema = z.object({ cursor: z.string().max(300).optional(), limit: z.coerce.number().int().min(1).max(100).default(30) });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const availabilitySchema = z.object({ listingId: z.uuid(), startDate: date, endDate: date, note: z.string().trim().max(300).optional(), locale: z.enum(['ar', 'en']).default('ar') });
const answerSchema = z.object({ available: z.boolean() });

@ApiTags('leads')
@Controller()
export class LeadsController {
  constructor(
    private readonly leads: LeadsService,
    private readonly availability: AvailabilityService,
    private readonly flags: FlagsService,
  ) {}

  @Post('leads')
  @ApiOperation({ summary: 'Log a contact (no sign-up needed) and get the WhatsApp / call deep link with a reference code.' })
  @OptionalAuth('customer')
  @Idempotent()
  @ZodBody(leadSchema)
  create(@Body(new ZodPipe(leadSchema)) b: z.output<typeof leadSchema>, @MaybeAuth() auth: AuthContext | undefined, @Client() c: ClientInfo): Promise<z.infer<typeof leadResponseSchema>> {
    return this.leads.create(b, { userId: auth?.userId ?? null, ip: c.ip });
  }

  @Get('dealer/leads')
  @Auth('dealer', 'dealer_owner', 'dealer_staff')
  @ZodQuery(pageSchema)
  list(@CurrentDealer() d: Dealer, @Query(new ZodPipe(pageSchema)) q: z.output<typeof pageSchema>) {
    return this.leads.dealerLeads(d.dealerId, q);
  }

  @Get('dealer/leads/by-ref/:ref')
  @Auth('dealer', 'dealer_owner', 'dealer_staff')
  byRef(@CurrentDealer() d: Dealer, @Param('ref') ref: string) {
    return this.leads.findByRef(d.dealerId, ref);
  }

  @Put('dealer/leads/:id/outcome')
  @Auth('dealer', 'dealer_owner', 'dealer_staff')
  @ZodBody(outcomeSchema)
  outcome(@CurrentDealer() d: Dealer, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(outcomeSchema)) b: z.output<typeof outcomeSchema>) {
    return this.leads.setOutcome(d.dealerId, id, b.outcome, d);
  }

  // ---- Phase 6: request availability ----
  private async gate() {
    if (!(await this.flags.isEnabled(FLAGS.availabilityRequests))) throw Errors.notFound('Route');
  }

  @Post('availability-requests')
  @Auth('customer')
  @Idempotent()
  @ZodBody(availabilitySchema)
  async request(@CurrentAuth() a: AuthContext, @Body(new ZodPipe(availabilitySchema)) b: z.output<typeof availabilitySchema>) {
    await this.gate();
    return this.availability.create(a.userId, b);
  }

  @Get('me/availability-requests')
  @Auth('customer')
  async mine(@CurrentAuth() a: AuthContext) {
    return { items: await this.availability.mine(a.userId) };
  }

  @Get('dealer/availability-requests')
  @Auth('dealer', 'dealer_owner', 'dealer_staff')
  async dealerRequests(@CurrentDealer() d: Dealer) {
    return { items: await this.availability.forDealer(d.dealerId) };
  }

  @Post('dealer/availability-requests/:id/answer')
  @HttpCode(200)
  @Auth('dealer', 'dealer_owner', 'dealer_staff')
  @ZodBody(answerSchema)
  answer(@CurrentDealer() d: Dealer, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(answerSchema)) b: z.output<typeof answerSchema>) {
    return this.availability.answer(d.dealerId, id, b.available);
  }
}
