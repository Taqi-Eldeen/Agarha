import { z } from 'zod';
import { OTP_CHANNELS, OTP_PURPOSES } from './enums.js';
import { egyptMobileSchema, localeSchema } from './common.js';

export const OTP_CODE_LENGTH = 6;

export const otpRequestSchema = z.object({
  phone: egyptMobileSchema,
  purpose: z.enum(OTP_PURPOSES).default('customer_sign_in'),
  /** Preferred channel. The server may fall back to the other one. */
  channel: z.enum(OTP_CHANNELS).default('sms'),
  locale: localeSchema.default('ar'),
  turnstileToken: z.string().min(1).max(2048),
});
export type OtpRequestInput = z.input<typeof otpRequestSchema>;
export type OtpRequest = z.output<typeof otpRequestSchema>;

export const otpRequestResponseSchema = z.object({
  challengeId: z.uuid(),
  channel: z.enum(OTP_CHANNELS),
  expiresAt: z.iso.datetime(),
  resendAfterSeconds: z.number().int(),
});
export type OtpRequestResponse = z.infer<typeof otpRequestResponseSchema>;

export const otpVerifySchema = z.object({
  challengeId: z.uuid(),
  phone: egyptMobileSchema,
  code: z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{${OTP_CODE_LENGTH}}$`), 'invalid_code_format'),
  /** Mobile clients receive tokens in the body; web gets httpOnly cookies. */
  client: z.enum(['web', 'mobile']).default('web'),
});
export type OtpVerifyInput = z.input<typeof otpVerifySchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(512).optional(),
  client: z.enum(['web', 'mobile']).default('web'),
});

export const sessionUserSchema = z.object({
  id: z.uuid(),
  phone: z.string(),
  roles: z.array(z.string()),
  locale: localeSchema,
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: z.iso.datetime(),
  refreshToken: z.string(),
  refreshTokenExpiresAt: z.iso.datetime(),
});

export const authResponseSchema = z.object({
  user: sessionUserSchema,
  /** Present only for mobile clients. */
  tokens: authTokensSchema.optional(),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;
