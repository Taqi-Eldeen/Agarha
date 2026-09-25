import { ERROR_CODES, type Role } from '@agarha/schemas';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { SignJWT, jwtVerify } from 'jose';
import { randomUUID } from 'node:crypto';
import { ENV, type Env } from '../../config/env';
import { DB, type Database } from '../../db/db';
import { refreshTokens } from '../../db/schema/identity';
import { randomToken, sha256 } from '../crypto';
import { AppError, Errors } from '../errors';
import type { AuthContext, SessionScope } from './auth-context';

export const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_DAYS: Record<SessionScope, number> = { customer: 30, dealer: 30, admin: 1 };
const FAMILY_TTL_DAYS: Record<SessionScope, number> = { customer: 180, dealer: 90, admin: 1 };
const DAY = 86_400_000;

export interface IssuedTokens {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

interface SessionClaims {
  userId: string;
  scope: SessionScope;
  roles: Role[];
  dealerId?: string;
}

/**
 * Access tokens: 15-minute HS256 JWTs (jose). Refresh tokens: opaque random strings stored as
 * SHA-256 hashes, rotated on every use; presenting an already-rotated token revokes the family.
 */
@Injectable()
export class TokenService {
  private readonly key: Uint8Array;

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(DB) private readonly db: Database,
  ) {
    this.key = new TextEncoder().encode(env.JWT_SECRET);
  }

  private async signAccess(
    c: SessionClaims,
    familyId: string,
  ): Promise<{ token: string; exp: Date }> {
    const exp = new Date(Date.now() + ACCESS_TTL_SECONDS * 1000);
    const token = await new SignJWT({
      scope: c.scope,
      roles: c.roles,
      did: c.dealerId,
      sid: familyId,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(c.userId)
      .setIssuer(this.env.JWT_ISSUER)
      .setAudience(`agarha:${c.scope}`)
      .setIssuedAt()
      .setExpirationTime(Math.floor(exp.getTime() / 1000))
      .sign(this.key);
    return { token, exp };
  }

  async verifyAccess(token: string, scope: SessionScope): Promise<AuthContext> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: this.env.JWT_ISSUER,
        audience: `agarha:${scope}`,
        algorithms: ['HS256'],
      });
      return {
        userId: String(payload.sub),
        scope,
        roles: (payload.roles as Role[]) ?? [],
        ...(payload.did ? { dealerId: String(payload.did) } : {}),
        sessionId: String(payload.sid),
      };
    } catch {
      throw Errors.unauthorized('Invalid or expired access token');
    }
  }

  /** Short-lived signed statement, e.g. "this phone passed OTP" or "password ok, awaiting TOTP". */
  async signProof(
    purpose: string,
    data: Record<string, unknown>,
    ttlSeconds = 600,
  ): Promise<string> {
    return new SignJWT(data)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(this.env.JWT_ISSUER)
      .setAudience(`agarha:proof:${purpose}`)
      .setIssuedAt()
      .setExpirationTime(`${ttlSeconds}s`)
      .sign(this.key);
  }

  async verifyProof<T extends Record<string, unknown>>(purpose: string, token: string): Promise<T> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: this.env.JWT_ISSUER,
        audience: `agarha:proof:${purpose}`,
        algorithms: ['HS256'],
      });
      return payload as unknown as T;
    } catch {
      throw Errors.unauthorized('Invalid or expired proof');
    }
  }

  async issue(
    c: SessionClaims,
    meta: { userAgent?: string; ipHash?: string } = {},
  ): Promise<IssuedTokens> {
    const familyId = randomUUID();
    const familyExpiresAt = new Date(Date.now() + FAMILY_TTL_DAYS[c.scope] * DAY);
    return this.issueInFamily(c, familyId, familyExpiresAt, meta);
  }

  private async issueInFamily(
    c: SessionClaims,
    familyId: string,
    familyExpiresAt: Date,
    meta: { userAgent?: string; ipHash?: string },
  ): Promise<IssuedTokens> {
    const refreshToken = randomToken(32);
    const refreshTokenExpiresAt = new Date(
      Math.min(Date.now() + REFRESH_TTL_DAYS[c.scope] * DAY, familyExpiresAt.getTime()),
    );
    await this.db.insert(refreshTokens).values({
      userId: c.userId,
      familyId,
      tokenHash: sha256(refreshToken),
      expiresAt: refreshTokenExpiresAt,
      familyExpiresAt,
      scope: c.scope,
      dealerId: c.dealerId ?? null,
      userAgent: meta.userAgent?.slice(0, 256) ?? null,
      ipHash: meta.ipHash ?? null,
    });
    const access = await this.signAccess(c, familyId);
    return {
      accessToken: access.token,
      accessTokenExpiresAt: access.exp,
      refreshToken,
      refreshTokenExpiresAt,
    };
  }

  /**
   * Rotates a refresh token. `resolveClaims` reloads roles so revoked permissions don't survive a refresh.
   */
  async rotate(
    presented: string,
    scope: SessionScope,
    resolveClaims: (userId: string, dealerId: string | null) => Promise<SessionClaims | null>,
    meta: { userAgent?: string; ipHash?: string } = {},
  ): Promise<IssuedTokens & { userId: string }> {
    const hash = sha256(presented);
    // Revocations must commit even though the request fails, so errors are thrown after the transaction.
    const outcome = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, hash))
        .for('update');
      if (!row || row.scope !== scope) return { error: 'unknown' as const };
      if (row.rotatedAt || row.revokedAt) {
        // Reuse of a rotated (or revoked) token: assume theft and kill the whole family.
        await tx
          .update(refreshTokens)
          .set({ revokedAt: new Date(), revokedReason: 'reuse_detected' })
          .where(and(eq(refreshTokens.familyId, row.familyId), isNull(refreshTokens.revokedAt)));
        return { error: 'reused' as const };
      }
      const now = Date.now();
      if (row.expiresAt.getTime() <= now || row.familyExpiresAt.getTime() <= now)
        return { error: 'expired' as const };

      const claims = await resolveClaims(row.userId, row.dealerId);
      if (!claims) {
        await tx
          .update(refreshTokens)
          .set({ revokedAt: new Date(), revokedReason: 'user_inactive' })
          .where(eq(refreshTokens.familyId, row.familyId));
        return { error: 'inactive' as const };
      }
      await tx
        .update(refreshTokens)
        .set({ rotatedAt: new Date() })
        .where(eq(refreshTokens.id, row.id));

      const refreshToken = randomToken(32);
      const refreshTokenExpiresAt = new Date(
        Math.min(now + REFRESH_TTL_DAYS[scope] * DAY, row.familyExpiresAt.getTime()),
      );
      await tx.insert(refreshTokens).values({
        userId: row.userId,
        familyId: row.familyId,
        tokenHash: sha256(refreshToken),
        expiresAt: refreshTokenExpiresAt,
        familyExpiresAt: row.familyExpiresAt,
        scope,
        dealerId: claims.dealerId ?? row.dealerId,
        userAgent: meta.userAgent?.slice(0, 256) ?? null,
        ipHash: meta.ipHash ?? null,
      });
      const access = await this.signAccess(claims, row.familyId);
      return {
        userId: row.userId,
        accessToken: access.token,
        accessTokenExpiresAt: access.exp,
        refreshToken,
        refreshTokenExpiresAt,
      };
    });
    if ('error' in outcome) {
      if (outcome.error === 'reused')
        throw new AppError(
          ERROR_CODES.refreshReused,
          HttpStatus.UNAUTHORIZED,
          'Refresh token reuse detected',
        );
      throw Errors.unauthorized(
        outcome.error === 'expired'
          ? 'Refresh token expired'
          : outcome.error === 'inactive'
            ? 'Account is not active'
            : 'Unknown refresh token',
      );
    }
    return outcome;
  }

  async revokeFamily(familyId: string, reason = 'sign_out'): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
  }

  async revokeAllForUser(userId: string, reason: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  }

  /** Revoke a single refresh token by value (sign-out without a valid access token). */
  async revokeByToken(presented: string): Promise<void> {
    const [row] = await this.db
      .select({ familyId: refreshTokens.familyId })
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, sha256(presented)));
    if (row) await this.revokeFamily(row.familyId);
  }
}
