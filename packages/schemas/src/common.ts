import { z } from 'zod';
import { LOCALES } from './enums.js';
import { normalizeEgyptMobile, normalizeEgyptPhone } from './phone.js';

export const localeSchema = z.enum(LOCALES);
export const uuidSchema = z.uuid();

/** Parses any accepted Egyptian mobile input into E.164. */
export const egyptMobileSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value, ctx) => {
    const e164 = normalizeEgyptMobile(value);
    if (!e164) {
      ctx.addIssue({ code: 'custom', message: 'invalid_egypt_mobile' });
      return z.NEVER;
    }
    return e164;
  });

export const egyptPhoneSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value, ctx) => {
    const e164 = normalizeEgyptPhone(value);
    if (!e164) {
      ctx.addIssue({ code: 'custom', message: 'invalid_egypt_phone' });
      return z.NEVER;
    }
    return e164;
  });

/** Whole Egyptian pounds. Prices are stored as integers; no piastres in listings. */
export const egpAmountSchema = z.number().int().nonnegative().max(10_000_000);

export const cursorPageQuerySchema = z.object({
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const errorBodySchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  requestId: z.string(),
});
export type ErrorBody = z.infer<typeof errorBodySchema>;

export const ERROR_CODES = {
  validation: 'validation_failed',
  unauthorized: 'unauthorized',
  forbidden: 'forbidden',
  notFound: 'not_found',
  conflict: 'conflict',
  rateLimited: 'rate_limited',
  captchaFailed: 'captcha_failed',
  otpInvalid: 'otp_invalid',
  otpExpired: 'otp_expired',
  otpTooManyAttempts: 'otp_too_many_attempts',
  otpDeliveryFailed: 'otp_delivery_failed',
  refreshReused: 'refresh_token_reused',
  internal: 'internal_error',
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
