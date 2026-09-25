import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import type { AuthContext } from '../../common/auth/auth-context';
import { AdminAuth, Auth, CurrentAuth, CurrentDealer } from '../../common/auth/guards';
import { TokenService } from '../../common/auth/token.service';
import { setAuthCookies } from '../../common/auth/cookies';
import { Errors } from '../../common/errors';
import { Client, type ClientInfo } from '../../common/request';
import { ZodBody, ZodPipe, ZodQuery } from '../../common/zod';
import { ENV, type Env } from '../../config/env';
import { Inject } from '@nestjs/common';
import { BillingService } from '../billing';
import { UsersService } from '../identity';
import { BRANCH_LISTINGS_CHECK, type BranchListingsCheck } from '../../common/ports';
import { DealersService } from './dealers.service';
import { adminDealerQuerySchema, branchSchema, businessSchema, inviteSchema, profileSchema, reasonSchema } from './dealers.schemas';

type Dealer = { dealerId: string; userId: string; role: 'dealer_owner' | 'dealer_staff' };
const clientSchema = z.object({ client: z.enum(['web', 'mobile']).default('web') });


@ApiTags('dealer')
@Controller('dealer')
export class DealerPortalController {
  constructor(
    private readonly dealers: DealersService,
    private readonly tokens: TokenService,
    private readonly users: UsersService,
    private readonly billing: BillingService,
    @Inject(ENV) private readonly env: Env,
    @Inject(BRANCH_LISTINGS_CHECK) private readonly branchHasListings: BranchListingsCheck,
  ) {}

  @Post('onboarding/business')
  @ApiOperation({ summary: 'Step 1 of onboarding: create the business. Re-issues the session with the new dealer context.' })
  @Auth('dealer')
  @ZodBody(businessSchema)
  async createBusiness(@CurrentAuth() a: AuthContext, @Body(new ZodPipe(businessSchema.extend(clientSchema.shape))) b: z.output<typeof businessSchema> & { client: 'web' | 'mobile' }, @Client() c: ClientInfo, @Res({ passthrough: true }) res: Response) {
    const d = await this.dealers.createBusiness(a.userId, b, { userId: a.userId, role: 'dealer_owner', ip: c.ip, requestId: c.requestId });
    await this.tokens.revokeFamily(a.sessionId, 'dealer_context_changed');
    const claims = await this.users.claimsFor(a.userId, 'dealer', d.id);
    const t = await this.tokens.issue(claims!, { userAgent: c.userAgent });
    if (b.client === 'web') setAuthCookies(res, this.env, 'dealer', t);
    return { dealer: d, session: { userId: a.userId, roles: claims!.roles, dealerId: d.id }, ...(b.client === 'mobile' ? { tokens: { accessToken: t.accessToken, refreshToken: t.refreshToken } } : {}) };
  }

  @Get('me')
  @Auth('dealer', 'dealer_owner', 'dealer_staff')
  async me(@CurrentDealer() d: Dealer) {
    const state = await this.dealers.onboardingState(d.dealerId);
    return { ...state, role: d.role, limits: await this.billing.limits(d.dealerId) };
  }

  @Patch('profile')
  @Auth('dealer', 'dealer_owner')
  @ZodBody(profileSchema)
  update(@CurrentDealer() d: Dealer, @Body(new ZodPipe(profileSchema)) b: z.output<typeof profileSchema>) {
    return this.dealers.updateProfile(d.dealerId, b, d);
  }

  @Post('onboarding/submit')
  @HttpCode(200)
  @Auth('dealer', 'dealer_owner')
  submit(@CurrentDealer() d: Dealer) {
    return this.dealers.submitForReview(d.dealerId, d);
  }

  @Get('branches')
  @Auth('dealer', 'dealer_owner', 'dealer_staff')
  async branches(@CurrentDealer() d: Dealer) {
    return { items: await this.dealers.branches(d.dealerId) };
  }

  @Post('branches')
  @Auth('dealer', 'dealer_owner')
  @ZodBody(branchSchema)
  createBranch(@CurrentDealer() d: Dealer, @Body(new ZodPipe(branchSchema)) b: z.output<typeof branchSchema>) {
    return this.dealers.saveBranch(d.dealerId, b, d);
  }

  @Put('branches/:id')
  @Auth('dealer', 'dealer_owner')
  @ZodBody(branchSchema)
  updateBranch(@CurrentDealer() d: Dealer, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(branchSchema)) b: z.output<typeof branchSchema>) {
    return this.dealers.saveBranch(d.dealerId, b, d, id);
  }

  @Delete('branches/:id')
  @HttpCode(204)
  @Auth('dealer', 'dealer_owner')
  async deleteBranch(@CurrentDealer() d: Dealer, @Param('id', ParseUUIDPipe) id: string) {
    await this.dealers.deleteBranch(d.dealerId, id, d, this.branchHasListings);
  }

  @Get('team')
  @Auth('dealer', 'dealer_owner')
  async team(@CurrentDealer() d: Dealer) {
    return { items: await this.dealers.team(d.dealerId), limits: await this.billing.limits(d.dealerId) };
  }

  @Post('team')
  @Auth('dealer', 'dealer_owner')
  @ZodBody(inviteSchema)
  async invite(@CurrentDealer() d: Dealer, @Body(new ZodPipe(inviteSchema)) b: z.output<typeof inviteSchema>) {
    const limits = await this.billing.limits(d.dealerId);
    return { items: await this.dealers.invite(d.dealerId, b.phone, b.role, d, limits.maxTeamMembers) };
  }

  @Delete('team/:userId')
  @Auth('dealer', 'dealer_owner')
  async remove(@CurrentDealer() d: Dealer, @Param('userId', ParseUUIDPipe) userId: string) {
    if (userId === d.userId) throw Errors.conflict('You cannot remove yourself');
    return { items: await this.dealers.removeMember(d.dealerId, userId, d) };
  }
}

@ApiTags('admin')
@Controller('admin/dealers')
export class AdminDealersController {
  constructor(private readonly dealers: DealersService) {}

  private actor(a: AuthContext, c?: ClientInfo) {
    return { userId: a.userId, role: a.roles.includes('admin') ? ('admin' as const) : (a.roles[0] ?? 'moderator'), ip: c?.ip, requestId: c?.requestId };
  }

  @Get()
  @AdminAuth('admin', 'moderator', 'support')
  @ZodQuery(adminDealerQuerySchema)
  list(@Query(new ZodPipe(adminDealerQuerySchema)) q: z.output<typeof adminDealerQuerySchema>) {
    return this.dealers.adminList(q);
  }

  @Get(':id')
  @AdminAuth('admin', 'moderator', 'support')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return { ...(await this.dealers.onboardingState(id)), team: await this.dealers.team(id) };
  }

  @Post(':id/verify')
  @HttpCode(200)
  @AdminAuth('admin', 'moderator')
  verify(@CurrentAuth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Client() c: ClientInfo) {
    return this.dealers.verify(id, this.actor(a, c));
  }

  @Post(':id/reject')
  @HttpCode(200)
  @AdminAuth('admin', 'moderator')
  @ZodBody(reasonSchema)
  reject(@CurrentAuth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(reasonSchema)) b: z.output<typeof reasonSchema>) {
    return this.dealers.reject(id, b.reason, this.actor(a));
  }

  @Post(':id/suspend')
  @HttpCode(200)
  @ApiOperation({ summary: 'Kill switch: hides every listing of this dealer immediately.' })
  @AdminAuth('admin', 'moderator')
  @ZodBody(reasonSchema)
  suspend(@CurrentAuth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(reasonSchema)) b: z.output<typeof reasonSchema>) {
    return this.dealers.suspend(id, b.reason, this.actor(a));
  }

  @Post(':id/unsuspend')
  @HttpCode(200)
  @AdminAuth('admin')
  unsuspend(@CurrentAuth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.dealers.unsuspend(id, this.actor(a));
  }
}
