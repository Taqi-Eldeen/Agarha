// Owned by the moderation module.
import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, tstz } from './_columns';
import { dealers } from './dealers';
import { reportReasonEnum, reportStatusEnum } from './enums';
import { users } from './identity';
import { listings } from './listings';

export const reports = pgTable(
  'reports',
  {
    id: id(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    listingId: uuid('listing_id').references(() => listings.id),
    dealerId: uuid('dealer_id').notNull().references(() => dealers.id),
    reason: reportReasonEnum('reason').notNull(),
    details: text('details'),
    status: reportStatusEnum('status').notNull().default('open'),
    handledBy: uuid('handled_by').references(() => users.id),
    handledAt: tstz('handled_at'),
    createdAt: createdAt(),
  },
  (t) => [index('reports_status_created_idx').on(t.status, t.createdAt), index('reports_dealer_idx').on(t.dealerId)],
);
