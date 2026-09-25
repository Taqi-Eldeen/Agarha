import type { TemplateId } from '../../modules/notifications/templates';
// Owned by the notifications module: one row per send attempt chain, with delivery status.
import { boolean, index, jsonb, pgTable, primaryKey, smallint, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, tstz, updatedAt } from './_columns';
import { deliveryStatusEnum, devicePlatformEnum, localeEnum, notificationChannelEnum } from './enums';
import { users } from './identity';

export const notificationDeliveries = pgTable(
  'notification_deliveries',
  {
    id: id(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    /** E.164, email or push token. Purged after 90 days. */
    recipient: text('recipient').notNull(),
    channel: notificationChannelEnum('channel').notNull(),
    template: text('template').notNull(),
    locale: localeEnum('locale').notNull(),
    provider: text('provider'),
    providerMessageId: text('provider_message_id'),
    status: deliveryStatusEnum('status').notNull().default('queued'),
    attempts: smallint('attempts').notNull().default(0),
    lastError: text('last_error'),
    /** e.g. otp_challenge / lead, for tracing a send back to its cause. */
    relatedType: text('related_type'),
    relatedId: uuid('related_id'),
    /** Template id, locale and variables, so the worker can render the message. */
    payload: jsonb('payload').$type<{ template: TemplateId; locale: 'ar' | 'en'; vars: Record<string, string | number>; data?: Record<string, string> }>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('notification_deliveries_provider_msg_idx').on(t.provider, t.providerMessageId),
    index('notification_deliveries_created_idx').on(t.createdAt),
  ],
);

/** Expo push tokens, one row per device. */
export const pushTokens = pgTable(
  'push_tokens',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    platform: devicePlatformEnum('platform').notNull(),
    locale: localeEnum('locale').notNull().default('ar'),
    lastSeenAt: tstz('last_seen_at').notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('push_tokens_token_key').on(t.token), index('push_tokens_user_idx').on(t.userId)],
);

/** Per-user, per-topic, per-channel opt-in. Missing row = default (on). */
export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    topic: text('topic').notNull(),
    channel: notificationChannelEnum('channel').notNull(),
    enabled: boolean('enabled').notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.topic, t.channel] })],
);
