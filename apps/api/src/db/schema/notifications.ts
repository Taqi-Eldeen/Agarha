// Owned by the notifications module: one row per send attempt chain, with delivery status.
import { index, pgTable, smallint, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, updatedAt } from './_columns';
import { deliveryStatusEnum, localeEnum, notificationChannelEnum } from './enums';
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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('notification_deliveries_provider_msg_idx').on(t.provider, t.providerMessageId),
    index('notification_deliveries_created_idx').on(t.createdAt),
  ],
);
