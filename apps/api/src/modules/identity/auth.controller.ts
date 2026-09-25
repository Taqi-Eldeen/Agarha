import {
  ERROR_CODES,
  authResponseSchema,
  egyptMobileSchema,
  localeSchema,
  otpRequestResponseSchema,
  otpRequestSchema,
  otpVerifySchema,
  refreshSchema,
  type OtpRequest,
} from '@agarha/schemas';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { z } from 'zod';
import type { AuthContext, SessionScope } from '../../common/auth/auth-context';
import { clearAuthCookies, cookieNames, setAuthCookies } from '../../common/auth/cookies';
import { Auth, CurrentAuth } from '../../common/auth/guards';
import { TokenService, type IssuedTokens } from '../../common/auth/token.service';
import { AppError, Errors } from '../../common/errors';
import { Client, type ClientInfo } from '../../common/request';
import { ZodBody, ZodPipe, ZodResponse } from '../../common/zod';
import { ENV, type Env } from '../../config/env';
import { AccountService } from './account.service';
import { OtpService } from './otp.service';
import { ID_TOKEN_VERIFIER, type IdTokenVerifier } from './ports';
import { UsersService } from './users.service';

const socialSchema = z.object({ provider: z.enum(['google', 'apple']), idToken: z.string().min(20).max(4096), client: z.enum(['web', 'mobile']).default('mobile') });
const socialLinkSchema = otpVerifySchema.extend({ linkToken: z.string().min(20) });
const updateMeSchema = z.object({ displayName: z.string().trim().min(1).max(60).nullable().optional(), locale: localeSchema.optional() });

export function tokenBody(t: IssuedTokens) {
  return {
    accessToken: t.accessToken,
    accessTokenExpiresAt: t.accessTokenExpiresAt.toISOString(),
    refreshToken: t.refreshToken,
    refreshTokenExpiresAt: t.refreshTokenExpiresAt.toISOString(),
  };
}

/** Delivers tokens the right way per client: httpOnly cookies on web, JSON body on mobile (stored in SecureStore). */
export function deliverTokens(res: Response, env: Env, scope: SessionScope, client: 'web' | 'mobile', t: IssuedTokens) {
  if (client === 'web') {
    setAuthCookies(res, env, scope, t);
    return undefined;
  }
  return tokenBody(t);
}

export function readRefresh(req: Request, scope: SessionScope, bodyToken?: string): string {
  const token = bodyToken ?? (req.cookies as Record<string, string> | undefined)?.[cookieNames(scope).refresh];
  if (!token) throw Errors.unauthorized('Missing refresh token');
  return token;
}

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly otp: OtpService,
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly account: AccountService,
    @Inject(ID_TOKEN_VERIFIER) private readonly idTokens: IdTokenVerifier,
  ) {}

  @Post('auth/otp/request')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send a sign-in code by SMS (WhatsApp fallback). Requires a Turnstile token.' })
  @ZodBody(otpRequestSchema)
  @ZodResponse(200, otpRequestResponseSchema)
  request(@Body(new ZodPipe(otpRequestSchema)) body: OtpRequest, @Client() client: ClientInfo) {
    return this.otp.request(body, client.ip);
  }

  @Post('auth/otp/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify a customer sign-in code. Web gets cookies, mobile gets tokens in the body.' })
  @ZodBody(otpVerifySchema)
  @ZodResponse(200, authResponseSchema)
  async verify(
    @Body(new ZodPipe(otpVerifySchema)) body: z.output<typeof otpVerifySchema>,
    @Client() client: ClientInfo,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { phone } = await this.otp.verify(body.challengeId, body.phone, body.code, client.ip, ['customer_sign_in']);
    const user = await this.users.findOrCreateByPhone(phone, 'ar');
    if (user.status !== 'active') throw Errors.forbidden('Account is blocked');
    await this.users.touchSignIn(user.id);
    const t = await this.tokens.issue({ userId: user.id, scope: 'customer', roles: ['customer'] }, { userAgent: client.userAgent, ipHash: this.otp.ipHash(client.ip) });
    const tokens = deliverTokens(res, this.env, 'customer', body.client, t);
    return { user: this.users.toSessionUser(user, ['customer']), ...(tokens ? { tokens } : {}) };
  }

  @Post('auth/otp/proof')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify a dealer sign-up / password-reset code and get a 10-minute phone proof.' })
  @ZodBody(otpVerifySchema)
  async proof(@Body(new ZodPipe(otpVerifySchema)) body: z.output<typeof otpVerifySchema>, @Client() client: ClientInfo) {
    const { phone, purpose } = await this.otp.verify(body.challengeId, body.phone, body.code, client.ip, ['dealer_sign_up', 'dealer_sign_in']);
    return { phoneProof: await this.tokens.signProof('phone', { phone, purpose }) };
  }

  @Post('auth/refresh')
  @HttpCode(200)
  @ZodBody(refreshSchema)
  async refresh(@Req() req: Request, @Body(new ZodPipe(refreshSchema)) body: z.output<typeof refreshSchema>, @Client() client: ClientInfo, @Res({ passthrough: true }) res: Response) {
    const presented = readRefresh(req, 'customer', body.refreshToken);
    try {
      const t = await this.tokens.rotate(presented, 'customer', (userId) => this.users.claimsFor(userId, 'customer'), { userAgent: client.userAgent });
      const user = (await this.users.findById(t.userId))!;
      const tokens = deliverTokens(res, this.env, 'customer', body.refreshToken ? 'mobile' : body.client, t);
      return { user: this.users.toSessionUser(user, ['customer']), ...(tokens ? { tokens } : {}) };
    } catch (e) {
      if (e instanceof AppError && e.code === ERROR_CODES.refreshReused) clearAuthCookies(res, this.env, 'customer');
      throw e;
    }
  }

  @Post('auth/sign-out')
  @HttpCode(204)
  async signOut(@Req() req: Request, @Body(new ZodPipe(refreshSchema)) body: z.output<typeof refreshSchema>, @Res({ passthrough: true }) res: Response) {
    const token = body.refreshToken ?? (req.cookies as Record<string, string> | undefined)?.[cookieNames('customer').refresh];
    if (token) await this.tokens.revokeByToken(token);
    clearAuthCookies(res, this.env, 'customer');
  }

  @Post('auth/social')
  @HttpCode(200)
  @ApiOperation({ summary: 'Google / Apple sign-in. First use needs the phone confirmed by OTP (returns linkToken).' })
  @ZodBody(socialSchema)
  async social(@Body(new ZodPipe(socialSchema)) body: z.output<typeof socialSchema>, @Client() client: ClientInfo, @Res({ passthrough: true }) res: Response) {
    const id = await this.idTokens.verify(body.provider, body.idToken);
    const identity = await this.users.findIdentity(body.provider, id.subject);
    if (!identity) {
      res.status(HttpStatus.ACCEPTED);
      return { status: 'phone_required', linkToken: await this.tokens.signProof('social-link', { provider: body.provider, subject: id.subject, email: id.email ?? null }) };
    }
    const user = await this.users.findById(identity.userId);
    if (!user || user.status !== 'active') throw Errors.forbidden('Account is blocked');
    const t = await this.tokens.issue({ userId: user.id, scope: 'customer', roles: ['customer'] }, { userAgent: client.userAgent });
    const tokens = deliverTokens(res, this.env, 'customer', body.client, t);
    return { status: 'signed_in', user: this.users.toSessionUser(user, ['customer']), ...(tokens ? { tokens } : {}) };
  }

  @Post('auth/social/link')
  @HttpCode(200)
  @ZodBody(socialLinkSchema)
  async socialLink(@Body(new ZodPipe(socialLinkSchema)) body: z.output<typeof socialLinkSchema>, @Client() client: ClientInfo, @Res({ passthrough: true }) res: Response) {
    const link = await this.tokens.verifyProof<{ provider: 'google' | 'apple'; subject: string; email: string | null }>('social-link', body.linkToken);
    const { phone } = await this.otp.verify(body.challengeId, body.phone, body.code, client.ip, ['customer_sign_in']);
    const user = await this.users.findOrCreateByPhone(phone, 'ar');
    await this.users.linkIdentity(user.id, link.provider, link.subject, link.email ?? undefined);
    const t = await this.tokens.issue({ userId: user.id, scope: 'customer', roles: ['customer'] }, { userAgent: client.userAgent });
    const tokens = deliverTokens(res, this.env, 'customer', body.client, t);
    return { user: this.users.toSessionUser(user, ['customer']), ...(tokens ? { tokens } : {}) };
  }

  @Get('me')
  @Auth('customer')
  async me(@CurrentAuth() auth: AuthContext) {
    const u = await this.users.findById(auth.userId);
    if (!u) throw Errors.unauthorized();
    return { ...this.users.toSessionUser(u, auth.roles), displayName: u.displayName };
  }

  @Patch('me')
  @Auth('customer')
  @ZodBody(updateMeSchema)
  async updateMe(@CurrentAuth() auth: AuthContext, @Body(new ZodPipe(updateMeSchema)) body: z.output<typeof updateMeSchema>) {
    await this.account.update(auth.userId, body);
    return this.me(auth);
  }

  @Get('me/export')
  @Auth('customer')
  @ApiOperation({ summary: 'PDPL data export: everything we hold about the signed-in user, as JSON.' })
  export(@CurrentAuth() auth: AuthContext) {
    return this.account.export(auth.userId);
  }

  @Delete('me')
  @HttpCode(204)
  @Auth('customer')
  @ApiOperation({ summary: 'Delete account: anonymises the user immediately and revokes every session.' })
  async deleteMe(@CurrentAuth() auth: AuthContext, @Res({ passthrough: true }) res: Response) {
    await this.account.delete(auth.userId);
    clearAuthCookies(res, this.env, 'customer');
  }

}
