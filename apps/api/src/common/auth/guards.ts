import type { Role } from '@agarha/schemas';
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  SetMetadata,
  UseGuards,
  applyDecorators,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiBearerAuth, ApiCookieAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { ENV, type Env } from '../../config/env';
import { Errors } from '../errors';
import type { AuthContext, SessionScope } from './auth-context';
import { cookieNames } from './cookies';
import { TokenService } from './token.service';
import { AdminIpGuard } from './admin-ip.guard';

const AUTH_META = 'agarha:auth';
interface AuthMeta {
  scope: SessionScope;
  roles?: Role[];
  optional?: boolean;
}

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<AuthMeta | undefined>(AUTH_META, [ctx.getHandler(), ctx.getClass()]);
    if (!meta) return true;
    const req = ctx.switchToHttp().getRequest<Request>();

    const header = req.headers.authorization;
    let token: string | undefined;
    let fromCookie = false;
    if (header?.startsWith('Bearer ')) token = header.slice(7);
    else {
      token = (req.cookies as Record<string, string> | undefined)?.[cookieNames(meta.scope).access];
      fromCookie = !!token;
    }
    if (!token) {
      if (meta.optional) return true;
      throw Errors.unauthorized();
    }
    // CSRF: cookie-authenticated writes must come from one of our own origins (SameSite=Lax is the first line).
    if (fromCookie && UNSAFE.has(req.method)) {
      const origin = req.headers.origin;
      if (!origin || !this.env.CORS_ORIGINS.includes(origin)) throw Errors.forbidden('Cross-origin request blocked');
    }
    const auth = await this.tokens.verifyAccess(token, meta.scope);
    if (meta.roles?.length && !meta.roles.some((r) => auth.roles.includes(r)))
      throw Errors.forbidden('Missing role');
    req.auth = auth;
    return true;
  }
}

/** Require a session of `scope` (and optionally one of `roles`). */
export const Auth = (scope: SessionScope, ...roles: Role[]) =>
  applyDecorators(SetMetadata(AUTH_META, { scope, roles } satisfies AuthMeta), UseGuards(AuthGuard), ApiBearerAuth(), ApiCookieAuth());

/** Attach the session if present; anonymous is fine. */
export const OptionalAuth = (scope: SessionScope) =>
  applyDecorators(SetMetadata(AUTH_META, { scope, optional: true } satisfies AuthMeta), UseGuards(AuthGuard));

export const CurrentAuth = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthContext => {
  const auth = ctx.switchToHttp().getRequest<Request>().auth;
  if (!auth) throw Errors.unauthorized();
  return auth;
});

export const MaybeAuth = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthContext | undefined => ctx.switchToHttp().getRequest<Request>().auth,
);

/** Dealer policy layer: every dealer-scoped handler gets the dealer id from the session, never from input. */
export const CurrentDealer = createParamDecorator((_: unknown, ctx: ExecutionContext): { dealerId: string; userId: string; role: Role } => {
  const auth = ctx.switchToHttp().getRequest<Request>().auth;
  if (!auth?.dealerId) throw Errors.forbidden('No dealer context');
  const role = auth.roles.includes('dealer_owner') ? 'dealer_owner' : 'dealer_staff';
  return { dealerId: auth.dealerId, userId: auth.userId, role };
});

/** Admin console endpoints: admin-scope session with one of `roles`, behind the IP allowlist. */
export const AdminAuth = (...roles: Role[]) =>
  applyDecorators(UseGuards(AdminIpGuard), Auth('admin', ...(roles.length ? roles : (['admin'] as Role[]))));
