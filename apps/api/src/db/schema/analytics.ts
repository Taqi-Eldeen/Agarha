// Owned by the analytics module: daily counters per listing for dealer stats.
import { date, integer, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { listings } from './listings';

export const listingDailyStats = pgTable(
  'listing_daily_stats',
  {
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    dealerId: uuid('dealer_id').notNull(),
    day: date('day').notNull(),
    views: integer('views').notNull().default(0),
    whatsappContacts: integer('whatsapp_contacts').notNull().default(0),
    callContacts: integer('call_contacts').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.listingId, t.day] })],
);
