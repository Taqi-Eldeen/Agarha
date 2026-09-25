// Owned by the leads module. Retention: 24 months (purged by a scheduled job).
import { sql } from 'drizzle-orm';
import { check, date, index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, tstz } from './_columns';
import { dealers } from './dealers';
import {
  availabilityRequestStatusEnum,
  leadChannelEnum,
  leadOutcomeEnum,
  localeEnum,
} from './enums';
import { users } from './identity';
import { listings } from './listings';

export const leads = pgTable(
  'leads',
  {
    id: id(),
    /** Human reference in the prefilled WhatsApp message, e.g. AG-7K2Q. */
    refCode: text('ref_code').notNull(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id),
    dealerId: uuid('dealer_id')
      .notNull()
      .references(() => dealers.id),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    channel: leadChannelEnum('channel').notNull(),
    locale: localeEnum('locale').notNull(),
    outcome: leadOutcomeEnum('outcome').notNull().default('unknown'),
    outcomeAt: tstz('outcome_at'),
    ipHash: text('ip_hash'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('leads_ref_code_key').on(t.refCode),
    index('leads_dealer_created_idx').on(t.dealerId, t.createdAt),
    index('leads_listing_created_idx').on(t.listingId, t.createdAt),
    index('leads_user_idx').on(t.userId),
  ],
);

/** Phase 6: "request availability for dates". The dealer answers yes/no; no booking is made. */
export const availabilityRequests = pgTable(
  'availability_requests',
  {
    id: id(),
    refCode: text('ref_code').notNull(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id),
    dealerId: uuid('dealer_id')
      .notNull()
      .references(() => dealers.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    note: text('note'),
    status: availabilityRequestStatusEnum('status').notNull().default('sent'),
    respondedAt: tstz('responded_at'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('availability_requests_ref_key').on(t.refCode),
    index('availability_requests_dealer_idx').on(t.dealerId, t.createdAt),
    check('availability_requests_dates', sql`${t.endDate} >= ${t.startDate}`),
  ],
);
