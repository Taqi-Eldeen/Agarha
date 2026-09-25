// Owned by the leads module. Retention: 24 months (purged by a scheduled job).
import { index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, tstz } from './_columns';
import { dealers } from './dealers';
import { leadChannelEnum, leadOutcomeEnum, localeEnum } from './enums';
import { users } from './identity';
import { listings } from './listings';

export const leads = pgTable(
  'leads',
  {
    id: id(),
    /** Human reference in the prefilled WhatsApp message, e.g. AG-7K2Q. */
    refCode: text('ref_code').notNull(),
    listingId: uuid('listing_id').notNull().references(() => listings.id),
    dealerId: uuid('dealer_id').notNull().references(() => dealers.id),
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
