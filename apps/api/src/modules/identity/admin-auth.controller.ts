import { ERROR_CODES } from '@agarha/schemas';
import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
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
import { AdminIpGuard } from '../../common/auth/admin-ip.guard';
import { deliverTokens, readRefresh } from './auth.controller';
import { ID_TOKEN_VERIFIER, type IdTokenVerifier } from './ports';
import { decryptSecret, encryptSecret, newTotpSecret, totpUri, verifyTotp } from './totp';
import { UsersService } from './users.service';

const googleSchema = z.object({ idToken: z.string().min(20).max(4096) });
const devSchema = z.object({ email: z.email() });
const codeSchema = z.object({ loginToken: z.string().min(20), code: z.string().regex(/^\d{6}$/) });
const setupSchema = z.object({ setupToken: z.string().min(20), code: z.string().regex(/^\d{6}$/) });

/** Admin: Google Workspace SSO (hd must match) + TOTP, behind the IP allowlist. Admin cookies live on the admin subdomain only. */
@ApiTags('admin-auth')
@UseGuards(AdminIpGuard)
@Controller('auth/admin')
export class AdminAuthController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly limiter: RateLimiter,
    @Inject(ID_TOKEN_VERIFIER) private readonly idTokens: IdTokenVerifier,
  ) {}

  @Post('google')
  @HttpCode(200)
  @ApiOperation({ summary: 'Step 1: Google Workspace ID token. Account must be pre-provisioned with a staff role.' })
  @ZodBody(googleSchema)
  async google(@Body(new ZodPipe(googleSchema)) body: z.output<typeof googleSchema>) {
    const id = await this.idTokens.verify('google_workspace', body.idToken);
    if (!id.emailVerified || id.hostedDomain !== this.env.GOOGLE_WORKSPACE_DOMAIN) throw Errors.forbidden('Use your company Google account');
    return this.afterSso(id.subject, id.email);
  }

  @Post('dev-login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Local/test stand-in for Google SSO. Disabled unless ADMIN_DEV_LOGIN=true (refused in production).' })
  @ZodBody(devSchema)
  async devLogin(@Body(new ZodPipe(devSchema)) body: z.output<typeof devSchema>) {
    if (!this.env.ADMIN_DEV_LOGIN) throw Errors.notFound('Route');
    return this.afterSso(`dev:${body.email}`, body.email);
  }

  private async afterSso(subject: string, email?: string) {
    const identity = await this.users.findIdentity('google_workspace', subject);
    if (!identity) throw Errors.forbidden(`No staff account for ${email ?? 'this identity'}`);
    const claims = await this.users.claimsFor(identity.userId, 'admin');
    if (!claims) throw Errors.forbidden('No staff role');
    const cred = await this.users.credentials(identity.userId);
    if (!cred?.totpEnabledAt) {
      const secret = newTotpSecret();
      return {
        next: 'totp_setup' as const,
        setupToken: await this.tokens.signProof('admin-totp-setup', { userId: identity.userId, secretEnc: encryptSecret(secret, this.env.TOTP_ENCRYPTION_KEY) }, 900),
        totp: { secret, uri: totpUri(secret, email ?? subject) },
      };
    }
    return { next: 'totp' as const, loginToken: await this.tokens.signProof('admin-login', { userId: identity.userId }, 300) };
  }

  @Post('totp/setup')
  @HttpCode(200)
  @ZodBody(setupSchema)
  async setup(@Body(new ZodPipe(setupSchema)) body: z.output<typeof setupSchema>, @Client() info: ClientInfo, @Res({ passthrough: true }) res: Response) {
    const p = await this.tokens.verifyProof<{ userId: string; secretEnc: string }>('admin-totp-setup', body.setupToken);
    const step = verifyTotp(decryptSecret(p.secretEnc, this.env.TOTP_ENCRYPTION_KEY), body.code, null);
    if (step === null) throw new AppError(ERROR_CODES.otpInvalid, HttpStatus.BAD_REQUEST, 'Invalid authenticator code');
    await this.users.upsertCredentials(p.userId, { totpSecretEnc: p.secretEnc, totpEnabledAt: new Date(), totpLastStep: step });
    return this.session(p.userId, info, res);
  }

  @Post('totp')
  @HttpCode(200)
  @ZodBody(codeSchema)
  async totp(@Body(new ZodPipe(codeSchema)) body: z.output<typeof codeSchema>, @Client() info: ClientInfo, @Res({ passthrough: true }) res: Response) {
    const p = await this.tokens.verifyProof<{ userId: string }>('admin-login', body.loginToken);
    await this.limiter.hit({ name: 'admin-totp', key: p.userId, max: 5, windowSeconds: 300 });
    const cred = await this.users.credentials(p.userId);
    if (!cred?.totpSecretEnc) throw Errors.unauthorized();
    const step = verifyTotp(decryptSecret(cred.totpSecretEnc, this.env.TOTP_ENCRYPTION_KEY), body.code, cred.totpLastStep);
    if (step === null) throw new AppError(ERROR_CODES.otpInvalid, HttpStatus.BAD_REQUEST, 'Invalid authenticator code');
    await this.users.upsertCredentials(p.userId, { totpLastStep: step });
    return this.session(p.userId, info, res);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Client() info: ClientInfo, @Res({ passthrough: true }) res: Response) {
    const t = await this.tokens.rotate(readRefresh(req, 'admin'), 'admin', (userId) => this.users.claimsFor(userId, 'admin'), { userAgent: info.userAgent });
    deliverTokens(res, this.env, 'admin', 'web', t);
    const claims = await this.users.claimsFor(t.userId, 'admin');
    return { session: { userId: t.userId, roles: claims?.roles ?? [] } };
  }

  @Post('sign-out')
  @HttpCode(204)
  async signOut(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies as Record<string, string> | undefined)?.[cookieNames('admin').refresh];
    if (token) await this.tokens.revokeByToken(token);
    clearAuthCookies(res, this.env, 'admin');
  }

  private async session(userId: string, info: ClientInfo, res: Response) {
    const claims = await this.users.claimsFor(userId, 'admin');
    if (!claims) throw Errors.forbidden('No staff role');
    await this.users.touchSignIn(userId);
    const t = await this.tokens.issue(claims, { userAgent: info.userAgent });
    deliverTokens(res, this.env, 'admin', 'web', t);
    return { session: { userId, roles: claims.roles } };
  }
}
