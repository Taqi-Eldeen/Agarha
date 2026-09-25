import type { CookieOptions, Response } from 'express';
import type { Env } from '../../config/env';
import type { SessionScope } from './auth-context';

/** Separate cookie pairs per surface, so a dealer signed into the portal is not a customer session. */
export const cookieNames = (scope: SessionScope) => ({
  access: `ag_${scope[0]}_at`,
  refresh: `ag_${scope[0]}_rt`,
});

function base(env: Env): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export function setAuthCookies(
  res: Response,
  env: Env,
  scope: SessionScope,
  t: { accessToken: string; accessTokenExpiresAt: Date; refreshToken: string; refreshTokenExpiresAt: Date },
): void {
  const n = cookieNames(scope);
  res.cookie(n.access, t.accessToken, { ...base(env), path: '/', expires: t.accessTokenExpiresAt });
  // Refresh cookie is only ever sent to the auth endpoints.
  res.cookie(n.refresh, t.refreshToken, { ...base(env), path: '/v1/auth', expires: t.refreshTokenExpiresAt });
}

export function clearAuthCookies(res: Response, env: Env, scope: SessionScope): void {
  const n = cookieNames(scope);
  res.clearCookie(n.access, { ...base(env), path: '/' });
  res.clearCookie(n.refresh, { ...base(env), path: '/v1/auth' });
}
