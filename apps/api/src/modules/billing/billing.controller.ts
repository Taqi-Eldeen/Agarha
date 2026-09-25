import { planSchema as planOut } from '@agarha/schemas';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AdminAuth, Auth, CurrentDealer } from '../../common/auth/guards';
import { PublicCache, UseCacheControl } from '../../common/cache';
import { Errors } from '../../common/errors';
import { Idempotent } from '../../common/idempotency';
import { ZodBody, ZodPipe, ZodResponse } from '../../common/zod';
import { ENV, type Env } from '../../config/env';
import { FLAGS, FlagsService } from '../../infra/flags';
import { BillingService } from './billing.service';
import { MockGateway } from './gateway';

type Dealer = { dealerId: string; userId: string; role: 'dealer_owner' | 'dealer_staff' };
const subscribeSchema = z.object({
  planCode: z.string().min(1).max(40),
  contactName: z.string().min(2).max(80),
  contactPhone: z.string().min(8).max(20),
  locale: z.enum(['ar', 'en']).default('ar'),
});
const featureSchema = z.object({
  listingId: z.uuid(),
  days: z.number().int().min(1).max(30),
  contactName: z.string().min(2).max(80),
  contactPhone: z.string().min(8).max(20),
  locale: z.enum(['ar', 'en']).default('ar'),
});
const planSchema = z.object({
  code: z
    .string()
    .regex(/^[a-z0-9_]+$/)
    .max(40),
  nameAr: z.string().min(1),
  nameEn: z.string().min(1),
  priceMonthlyEgp: z.number().int().min(0),
  maxLiveListings: z.number().int().min(1).nullable(),
  maxTeamMembers: z.number().int().min(1),
  featuredCreditsPerMonth: z.number().int().min(0),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
});

@ApiTags('billing')
@UseCacheControl()
@Controller()
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly flags: FlagsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private async gate() {
    if (!(await this.flags.isEnabled(FLAGS.billing))) throw Errors.notFound('Billing');
  }

  @Get('plans')
  @PublicCache(300)
  @ZodResponse(200, z.object({ items: z.array(planOut) }))
  async plans() {
    return { items: await this.billing.listPlans() };
  }

  @Get('dealer/billing')
  @Auth('dealer', 'dealer_owner')
  overview(@CurrentDealer() d: Dealer) {
    return this.billing.overview(d.dealerId);
  }

  @Get('dealer/billing/invoices/:id')
  @Auth('dealer', 'dealer_owner')
  invoice(@CurrentDealer() d: Dealer, @Param('id', ParseUUIDPipe) id: string) {
    return this.billing.invoice(d.dealerId, id);
  }

  @Post('dealer/billing/subscribe')
  @HttpCode(200)
  @Auth('dealer', 'dealer_owner')
  @Idempotent()
  @ZodBody(subscribeSchema)
  async subscribe(
    @CurrentDealer() d: Dealer,
    @Body(new ZodPipe(subscribeSchema)) b: z.output<typeof subscribeSchema>,
  ) {
    await this.gate();
    return this.billing.subscribe(
      d.dealerId,
      b.planCode,
      { name: b.contactName, phone: b.contactPhone },
      d,
      b.locale,
    );
  }

  @Post('dealer/billing/cancel')
  @HttpCode(200)
  @Auth('dealer', 'dealer_owner')
  cancel(@CurrentDealer() d: Dealer) {
    return this.billing.cancel(d.dealerId, d);
  }

  @Post('dealer/billing/feature')
  @HttpCode(200)
  @Auth('dealer', 'dealer_owner')
  @Idempotent()
  @ZodBody(featureSchema)
  async feature(
    @CurrentDealer() d: Dealer,
    @Body(new ZodPipe(featureSchema)) b: z.output<typeof featureSchema>,
    @Req() _req: Request,
  ) {
    await this.gate();
    return this.billing.feature(
      d.dealerId,
      b.listingId,
      b.days,
      { name: b.contactName, phone: b.contactPhone },
      d,
      b.locale,
    );
  }

  /** Payment gateway callbacks. Signature is verified by the gateway adapter. */
  @Post('webhooks/payments/:gateway')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  webhook(
    @Param('gateway') gateway: string,
    @Query() query: Record<string, string>,
    @Req() req: Request & { rawBody?: Buffer },
  ) {
    return this.billing.handleWebhook(
      gateway,
      query,
      req.headers as Record<string, string | undefined>,
      req.rawBody?.toString('utf8') ?? '',
    );
  }

  /** Local/test only: simulates the mock gateway paying an invoice (the web mock-checkout page calls this). */
  @Post('dev/payments/mock/:invoiceId')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async mockPay(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() body: { success?: boolean; amountEgp: number },
  ) {
    if (this.env.APP_ENV === 'production' || !(this.billing.gateway instanceof MockGateway))
      throw Errors.notFound('Route');
    const raw = JSON.stringify({
      eventId: randomUUID(),
      invoiceId,
      success: body.success !== false,
      amountEgp: body.amountEgp,
    });
    return this.billing.handleWebhook(
      'mock',
      {},
      { 'x-mock-signature': this.billing.gateway.sign(raw) },
      raw,
    );
  }

  // ---- admin ----
  @Get('admin/plans')
  @AdminAuth('admin', 'support')
  async adminPlans() {
    return { items: await this.billing.listPlans(true) };
  }

  @Put('admin/plans/:code')
  @AdminAuth('admin')
  @ZodBody(planSchema)
  savePlan(
    @Param('code') code: string,
    @Body(new ZodPipe(planSchema)) b: z.output<typeof planSchema>,
  ) {
    if (code !== b.code) throw Errors.badRequest('validation_failed', 'code mismatch');
    return this.billing.upsertPlan(b);
  }

  @Get('admin/invoices')
  @AdminAuth('admin', 'support')
  async invoices(@Query('status') status?: string) {
    return { items: await this.billing.adminInvoices(status) };
  }
}
