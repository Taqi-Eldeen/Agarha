import { ERROR_CODES, OTP_CODE_LENGTH, type OtpRequest } from '@agarha/schemas';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { ENV, type Env } from '../../config/env';
import { hmac, randomDigits, safeEqualHex } from '../../common/crypto';
import { AppError } from '../../common/errors';
import { DB, type Database } from '../../db/db';
import { otpChallenges } from '../../db/schema/identity';
import { RateLimiter } from '../../infra/redis/rate-limiter';
import { OtpDeliveryFailed, OtpDeliveryService } from '../notifications';
import { TURNSTILE, type TurnstileVerifier } from './turnstile';

/** Abuse limits (risk #6). Per-number: 3 sends / 15 min. Per-IP: 10 / 15 min and 30 / day. */
export const OTP_LIMITS = {
  phone: { max: 3, windowSeconds: 15 * 60 },
  ip: { max: 10, windowSeconds: 15 * 60 },
  ipDaily: { max: 30, windowSeconds: 86_400 },
  verifyIp: { max: 30, windowSeconds: 15 * 60 },
};

@Injectable()
export class OtpService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(DB) private readonly db: Database,
    @Inject(TURNSTILE) private readonly turnstile: TurnstileVerifier,
    private readonly limiter: RateLimiter,
    private readonly delivery: OtpDeliveryService,
  ) {}

  ipHash(ip: string | undefined): string | undefined {
    return ip ? hmac(this.env.HASH_PEPPER, `ip:${ip}`) : undefined;
  }

  private codeHash(challengeId: string, code: string): string {
    return hmac(this.env.HASH_PEPPER, `otp:${challengeId}:${code}`);
  }

  async request(input: OtpRequest, ip: string | undefined) {
    // 1. Turnstile before anything that costs money.
    if (!(await this.turnstile.verify(input.turnstileToken, ip)))
      throw new AppError(ERROR_CODES.captchaFailed, HttpStatus.BAD_REQUEST, 'Captcha verification failed');

    // 2. Rate limits: IP first (cheap), then number.
    const ipKey = this.ipHash(ip) ?? 'unknown';
    await this.limiter.hit(
      { name: 'otp:ip', key: ipKey, ...OTP_LIMITS.ip },
      { name: 'otp:ip:day', key: ipKey, ...OTP_LIMITS.ipDaily },
      { name: 'otp:phone', key: input.phone, ...OTP_LIMITS.phone },
    );

    // 3. Create the challenge, then send.
    const code = randomDigits(OTP_CODE_LENGTH);
    const expiresAt = new Date(Date.now() + this.env.OTP_TTL_SECONDS * 1000);
    const [row] = await this.db
      .insert(otpChallenges)
      .values({
        phoneE164: input.phone,
        purpose: input.purpose,
        codeHash: 'pending',
        channel: input.channel,
        maxAttempts: this.env.OTP_MAX_ATTEMPTS,
        expiresAt,
        ipHash: this.ipHash(ip) ?? null,
      })
      .returning({ id: otpChallenges.id });
    const challengeId = row!.id;
    await this.db.update(otpChallenges).set({ codeHash: this.codeHash(challengeId, code) }).where(eq(otpChallenges.id, challengeId));

    try {
      const sent = await this.delivery.send({
        phone: input.phone,
        code,
        locale: input.locale,
        preferred: input.channel,
        ttlMinutes: Math.round(this.env.OTP_TTL_SECONDS / 60),
        challengeId,
      });
      if (sent.channel !== input.channel)
        await this.db.update(otpChallenges).set({ channel: sent.channel }).where(eq(otpChallenges.id, challengeId));
      return {
        challengeId,
        channel: sent.channel,
        expiresAt: expiresAt.toISOString(),
        resendAfterSeconds: this.env.OTP_RESEND_AFTER_SECONDS,
      };
    } catch (err) {
      if (err instanceof OtpDeliveryFailed) {
        await this.db.update(otpChallenges).set({ consumedAt: new Date() }).where(eq(otpChallenges.id, challengeId));
        throw new AppError(ERROR_CODES.otpDeliveryFailed, HttpStatus.BAD_GATEWAY, 'Could not deliver the code');
      }
      throw err;
    }
  }

  /** Verifies and consumes a challenge. Returns the verified E.164 phone and purpose. */
  async verify(challengeId: string, phone: string, code: string, ip: string | undefined, expectedPurposes: string[]) {
    await this.limiter.hit({ name: 'otp:verify:ip', key: this.ipHash(ip) ?? 'unknown', ...OTP_LIMITS.verifyIp });
    // The attempt counter must survive a failed check, so errors are thrown after commit.
    const outcome = await this.db.transaction(async (tx) => {
      const [c] = await tx.select().from(otpChallenges).where(eq(otpChallenges.id, challengeId)).for('update');
      // Same error for "unknown challenge" and "wrong phone" so ids can't be probed.
      if (!c || c.phoneE164 !== phone || !expectedPurposes.includes(c.purpose)) return { error: 'invalid' as const };
      if (c.consumedAt || c.expiresAt.getTime() < Date.now()) return { error: 'expired' as const };
      if (c.attempts >= c.maxAttempts) return { error: 'locked' as const };
      if (!safeEqualHex(c.codeHash, this.codeHash(c.id, code))) {
        await tx.update(otpChallenges).set({ attempts: sql`${otpChallenges.attempts} + 1` }).where(eq(otpChallenges.id, c.id));
        const left = c.maxAttempts - c.attempts - 1;
        return left <= 0 ? { error: 'locked' as const } : { error: 'invalid' as const, attemptsLeft: left };
      }
      await tx.update(otpChallenges).set({ consumedAt: new Date() }).where(eq(otpChallenges.id, c.id));
      return { phone: c.phoneE164, purpose: c.purpose };
    });
    if ('error' in outcome) {
      if (outcome.error === 'expired') throw new AppError(ERROR_CODES.otpExpired, HttpStatus.BAD_REQUEST, 'Code expired or used');
      if (outcome.error === 'locked') throw new AppError(ERROR_CODES.otpTooManyAttempts, HttpStatus.BAD_REQUEST, 'Too many attempts');
      throw new AppError(ERROR_CODES.otpInvalid, HttpStatus.BAD_REQUEST, 'Invalid code', 'attemptsLeft' in outcome ? { attemptsLeft: outcome.attemptsLeft } : undefined);
    }
    return outcome;
  }
}
