// Owned by the reviews module. Only a signed-in user's tracked lead can produce a review (Q7).
import { sql } from 'drizzle-orm';
import { check, index, pgTable, smallint, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, tstz, updatedAt } from './_columns';
import { dealers } from './dealers';
import { reviewStatusEnum } from './enums';
import { users } from './identity';
import { leads } from './leads';

export const reviews = pgTable(
  'reviews',
  {
    id: id(),
    dealerId: uuid('dealer_id')
      .notNull()
      .references(() => dealers.id),
    /** Nulled when the lead is purged after 24 months; the review stays. */
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    rating: smallint('rating').notNull(),
    body: text('body'),
    status: reviewStatusEnum('status').notNull().default('pending'),
    moderatedBy: uuid('moderated_by').references(() => users.id),
    moderatedAt: tstz('moderated_at'),
    dealerReply: text('dealer_reply'),
    dealerRepliedAt: tstz('dealer_replied_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('reviews_lead_key').on(t.leadId),
    index('reviews_dealer_status_idx').on(t.dealerId, t.status),
    check('reviews_rating_range', sql`${t.rating} between 1 and 5`),
  ],
);
