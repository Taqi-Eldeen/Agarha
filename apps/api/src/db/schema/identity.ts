// Owned by the identity module.
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, id, tstz, updatedAt } from './_columns';
import {
  localeEnum,
  otpChannelEnum,
  otpPurposeEnum,
  roleEnum,
  sessionScopeEnum,
  socialProviderEnum,
  userStatusEnum,
} from './enums';

export const users = pgTable(
  'users',
  {
    id: id(),
    /** E.164. Nulled on account deletion (PDPL), the row stays for lead/review integrity. */
    phoneE164: text('phone_e164'),
    displayName: text('display_name'),
    locale: localeEnum('locale').notNull().default('ar'),
    status: userStatusEnum('status').notNull().default('active'),
    lastSignInAt: tstz('last_sign_in_at'),
    deletionRequestedAt: tstz('deletion_requested_at'),
    deletedAt: tstz('deleted_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('users_phone_e164_key').on(t.phoneE164),
    check('users_phone_e164_format', sql`${t.phoneE164} ~ '^\\+[1-9][0-9]{7,14}$'`),
  ],
);

/** Platform roles (customer, moderator, support, admin). Dealer roles live on dealer_members. */
export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: roleEnum('role').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.role] }),
    check('user_roles_platform_only', sql`${t.role} not in ('dealer_owner', 'dealer_staff')`),
  ],
);

export const otpChallenges = pgTable(
  'otp_challenges',
  {
    id: id(),
    phoneE164: text('phone_e164').notNull(),
    purpose: otpPurposeEnum('purpose').notNull(),
    /** HMAC-SHA256(pepper, challengeId:code). The code itself is never stored. */
    codeHash: text('code_hash').notNull(),
    channel: otpChannelEnum('channel').notNull(),
    attempts: smallint('attempts').notNull().default(0),
    maxAttempts: smallint('max_attempts').notNull(),
    expiresAt: tstz('expires_at').notNull(),
    consumedAt: tstz('consumed_at'),
    /** HMAC of the requesting IP, for abuse investigation without keeping raw IPs. */
    ipHash: text('ip_hash'),
    createdAt: createdAt(),
  },
  (t) => [index('otp_challenges_phone_created_idx').on(t.phoneE164, t.createdAt)],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** All tokens rotated from one sign-in share a family; reuse of any rotated token revokes it. */
    familyId: uuid('family_id').notNull(),
    /** SHA-256 of the opaque token. */
    tokenHash: text('token_hash').notNull(),
    expiresAt: tstz('expires_at').notNull(),
    familyExpiresAt: tstz('family_expires_at').notNull(),
    /** customer | dealer | admin: which surface the session belongs to. */
    scope: sessionScopeEnum('scope').notNull(),
    /** Active dealer for dealer-scope sessions. */
    dealerId: uuid('dealer_id'),
    rotatedAt: tstz('rotated_at'),
    revokedAt: tstz('revoked_at'),
    revokedReason: text('revoked_reason'),
    userAgent: text('user_agent'),
    ipHash: text('ip_hash'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('refresh_tokens_token_hash_key').on(t.tokenHash),
    index('refresh_tokens_family_idx').on(t.familyId),
    index('refresh_tokens_user_idx').on(t.userId),
  ],
);

/** Password (dealers) and TOTP (dealer owners, admins). */
export const userCredentials = pgTable('user_credentials', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** argon2id hash. */
  passwordHash: text('password_hash'),
  /** AES-256-GCM encrypted TOTP secret (iv:tag:ciphertext, base64url). */
  totpSecretEnc: text('totp_secret_enc'),
  totpEnabledAt: tstz('totp_enabled_at'),
  /** Last accepted TOTP time-step, to block replay inside the window. */
  totpLastStep: integer('totp_last_step'),
  failedPasswordAttempts: smallint('failed_password_attempts').notNull().default(0),
  lockedUntil: tstz('locked_until'),
  updatedAt: updatedAt(),
});

/** Google / Apple sign-in (customers) and Google Workspace SSO (admins). */
export const userIdentities = pgTable(
  'user_identities',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: socialProviderEnum('provider').notNull(),
    subject: text('subject').notNull(),
    email: text('email'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('user_identities_provider_subject_key').on(t.provider, t.subject)],
);
