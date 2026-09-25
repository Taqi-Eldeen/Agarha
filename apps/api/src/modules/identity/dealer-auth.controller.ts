import { ERROR_CODES, egyptMobileSchema, refreshSchema } from '@agarha/schemas';
import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { clearAuthCookies, cookieNames } from '../../common/auth/cookies';
import { TokenService } from '../../common/auth/token.service';
import { AppError, Errors } from '../../common/errors';
import { Client, type ClientInfo } from '../../common/request';
import { ZodBody, ZodPipe } from '../../common/zod';
import { ENV, type Env } from '../../config/env';
import { RateLimiter } from '../../infra/redis/rate-limiter';
import { deliverTokens, readRefresh } from './auth.controller';
import { OtpService } from './otp.service';
import { dummyHash, hashPassword, passwordSchema, verifyPassword } from './password';
import { decryptSecret, encryptSecret, newTotpSecret, totpUri, verifyTotp } from './totp';
import { UsersService, type Claims } from './users.service';

const client = z.enum(['web', 'mobile']).default('web');
const registerSchema = z.object({ phoneProof: z.string().min(20), password: passwordSchema, displayName: z.string().trim().min(2).max(60) });
const totpConfirmSchema = z.object({ setupToken: z.string().min(20), code: z.string().regex(/^\d{6}$/), client });
const loginSchema = z.object({ phone: egyptMobileSchema, password: z.string().min(1).max(128), turnstileToken: z.string().min(1), locale: z.enum(['ar', 'en']).default('ar') });
const loginVerifySchema = z.object({ loginToken: z.string().min(20), code: z.string().regex(/^\d{6}$/), challengeId: z.uuid().optional(), dealerId: z.uuid().optional(), client });
const resetSchema = z.object({ phoneProof: z.string().min(20), password: passwordSchema });

const LOCK_AFTER = 10;
const LOCK_MINUTES = 15;

/**
 * Dealer sessions: phone OTP proves the number at sign-up; sign-in is password + a second factor.
 * Owners: TOTP (mandatory). Staff: SMS OTP.
 */
@ApiTags('dealer-auth')
@Controller('auth/dealer')
export class DealerAuthController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly otp: OtpService,
    private readonly limiter: RateLimiter,
  ) {}

  @Post('register')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a dealer login from a phone proof. Returns a TOTP enrollment the owner must confirm.' })
  @ZodBody(registerSchema)
  async register(@Body(new ZodPipe(registerSchema)) body: z.output<typeof registerSchema>) {
    const proof = await this.tokens.verifyProof<{ phone: string; purpose: string }>('phone', body.phoneProof);
    if (proof.purpose !== 'dealer_sign_up') throw Errors.forbidden('Wrong proof purpose');
    const user = await this.users.findOrCreateByPhone(proof.phone, 'ar');
    const existing = await this.users.credentials(user.id);
    if (existing?.passwordHash) throw Errors.conflict('This number already has a dealer login. Sign in instead.');
    await this.users.upsertCredentials(user.id, { passwordHash: await hashPassword(body.password) });
    if (!user.displayName) await this.users.setDisplayName(user.id, body.displayName);
    return this.startTotpSetup(user.id, proof.phone);
  }

  private async startTotpSetup(userId: string, phone: string) {
    const secret = newTotpSecret();
    const setupToken = await this.tokens.signProof('totp-setup', { userId, secretEnc: encryptSecret(secret, this.env.TOTP_ENCRYPTION_KEY) }, 900);
    return { next: 'totp_setup' as const, setupToken, totp: { secret, uri: totpUri(secret, phone) } };
  }

  @Post('totp/confirm')
  @HttpCode(200)
  @ZodBody(totpConfirmSchema)
  async confirmTotp(@Body(new ZodPipe(totpConfirmSchema)) body: z.output<typeof totpConfirmSchema>, @Client() info: ClientInfo, @Res({ passthrough: true }) res: Response) {
    const p = await this.tokens.verifyProof<{ userId: string; secretEnc: string }>('totp-setup', body.setupToken);
    const step = verifyTotp(decryptSecret(p.secretEnc, this.env.TOTP_ENCRYPTION_KEY), body.code, null);
    if (step === null) throw new AppError(ERROR_CODES.otpInvalid, HttpStatus.BAD_REQUEST, 'Invalid authenticator code');
    await this.users.upsertCredentials(p.userId, { totpSecretEnc: p.secretEnc, totpEnabledAt: new Date(), totpLastStep: step });
    return this.session(p.userId, undefined, body.client, info, res);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Step 1: phone + password. Returns which second factor to send next.' })
  @ZodBody(loginSchema)
  async login(@Body(new ZodPipe(loginSchema)) body: z.output<typeof loginSchema>, @Client() info: ClientInfo) {
    await this.limiter.hit({ name: 'dealer-login:phone', key: body.phone, max: 20, windowSeconds: 900 }, { name: 'dealer-login:ip', key: this.otp.ipHash(info.ip) ?? 'x', max: 30, windowSeconds: 900 });
    const user = await this.users.findByPhone(body.phone);
    const cred = user ? await this.users.credentials(user.id) : null;
    const ok = await verifyPassword(cred?.passwordHash ?? (await dummyHash()), body.password);
    if (!user || !cred?.passwordHash || user.status !== 'active') throw Errors.unauthorized('Wrong phone number or password');
    if (cred.lockedUntil && cred.lockedUntil.getTime() > Date.now()) throw Errors.rateLimited(Math.ceil((cred.lockedUntil.getTime() - Date.now()) / 1000));
    if (!ok) {
      const failed = cred.failedPasswordAttempts + 1;
      await this.users.upsertCredentials(user.id, { failedPasswordAttempts: failed, ...(failed >= LOCK_AFTER ? { lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000), failedPasswordAttempts: 0 } : {}) });
      throw Errors.unauthorized('Wrong phone number or password');
    }
    await this.users.upsertCredentials(user.id, { failedPasswordAttempts: 0, lockedUntil: null });

    const claims = await this.users.claimsFor(user.id, 'dealer');
    const isOwner = !claims || claims.roles.length === 0 || claims.roles.includes('dealer_owner');
    if (cred.totpEnabledAt) return { next: 'totp' as const, loginToken: await this.tokens.signProof('dealer-login', { userId: user.id, factor: 'totp' }, 300) };
    if (isOwner) return this.startTotpSetup(user.id, body.phone);
    // Staff without TOTP: SMS OTP as the second factor. Turnstile was already passed for this login.
    const sent = await this.otp.request({ phone: body.phone, purpose: 'dealer_sign_in', channel: 'sms', locale: body.locale, turnstileToken: body.turnstileToken }, info.ip);
    return { next: 'otp' as const, challengeId: sent.challengeId, channel: sent.channel, loginToken: await this.tokens.signProof('dealer-login', { userId: user.id, factor: 'otp', phone: body.phone }, 600) };
  }

  @Post('login/verify')
  @HttpCode(200)
  @ZodBody(loginVerifySchema)
  async loginVerify(@Body(new ZodPipe(loginVerifySchema)) body: z.output<typeof loginVerifySchema>, @Client() info: ClientInfo, @Res({ passthrough: true }) res: Response) {
    const p = await this.tokens.verifyProof<{ userId: string; factor: 'totp' | 'otp'; phone?: string }>('dealer-login', body.loginToken);
    if (p.factor === 'totp') {
      await this.limiter.hit({ name: 'dealer-totp', key: p.userId, max: 5, windowSeconds: 300 });
      const cred = await this.users.credentials(p.userId);
      if (!cred?.totpSecretEnc) throw Errors.unauthorized();
      const step = verifyTotp(decryptSecret(cred.totpSecretEnc, this.env.TOTP_ENCRYPTION_KEY), body.code, cred.totpLastStep);
      if (step === null) throw new AppError(ERROR_CODES.otpInvalid, HttpStatus.BAD_REQUEST, 'Invalid authenticator code');
      await this.users.upsertCredentials(p.userId, { totpLastStep: step });
    } else {
      if (!body.challengeId || !p.phone) throw Errors.badRequest(ERROR_CODES.validation, 'challengeId required');
      await this.otp.verify(body.challengeId, p.phone, body.code, info.ip, ['dealer_sign_in']);
    }
    return this.session(p.userId, body.dealerId, body.client, info, res);
  }

  @Post('password/reset')
  @HttpCode(204)
  @ZodBody(resetSchema)
  async reset(@Body(new ZodPipe(resetSchema)) body: z.output<typeof resetSchema>) {
    const proof = await this.tokens.verifyProof<{ phone: string; purpose: string }>('phone', body.phoneProof);
    if (proof.purpose !== 'dealer_sign_in') throw Errors.forbidden('Wrong proof purpose');
    const user = await this.users.findByPhone(proof.phone);
    if (!user) throw Errors.notFound('Account');
    await this.users.upsertCredentials(user.id, { passwordHash: await hashPassword(body.password), failedPasswordAttempts: 0, lockedUntil: null });
    await this.tokens.revokeAllForUser(user.id, 'password_reset');
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Body(new ZodPipe(refreshSchema.extend({ dealerId: z.uuid().optional() }))) body: { refreshToken?: string; client: 'web' | 'mobile'; dealerId?: string }, @Client() info: ClientInfo, @Res({ passthrough: true }) res: Response) {
    const presented = readRefresh(req, 'dealer', body.refreshToken);
    let claims: Claims | null = null;
    const t = await this.tokens.rotate(presented, 'dealer', async (userId, dealerId) => (claims = await this.users.claimsFor(userId, 'dealer', body.dealerId ?? dealerId)), { userAgent: info.userAgent });
    const tokens = deliverTokens(res, this.env, 'dealer', body.refreshToken ? 'mobile' : body.client, t);
    return { session: this.describe(claims!), ...(tokens ? { tokens } : {}) };
  }

  @Post('sign-out')
  @HttpCode(204)
  async signOut(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies as Record<string, string> | undefined)?.[cookieNames('dealer').refresh];
    if (token) await this.tokens.revokeByToken(token);
    clearAuthCookies(res, this.env, 'dealer');
  }

  private describe(c: Claims) {
    return { userId: c.userId, roles: c.roles, dealerId: c.dealerId ?? null };
  }

  private async session(userId: string, dealerId: string | undefined, client: 'web' | 'mobile', info: ClientInfo, res: Response) {
    const claims = await this.users.claimsFor(userId, 'dealer', dealerId ?? null);
    if (!claims) throw Errors.forbidden('Account is not active');
    await this.users.touchSignIn(userId);
    const t = await this.tokens.issue(claims, { userAgent: info.userAgent, ipHash: this.otp.ipHash(info.ip) });
    const tokens = deliverTokens(res, this.env, 'dealer', client, t);
    return { session: this.describe(claims), ...(tokens ? { tokens } : {}) };
  }
}
