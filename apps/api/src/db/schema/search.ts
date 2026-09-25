// Owned by the search module.
import { boolean, index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, tstz } from './_columns';
import { users } from './identity';

export const savedSearches = pgTable(
  'saved_searches',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name'),
    /** Validated search query (same shape as GET /v1/search params). */
    query: jsonb('query').notNull(),
    alertsEnabled: boolean('alerts_enabled').notNull().default(true),
    lastNotifiedAt: tstz('last_notified_at'),
    createdAt: createdAt(),
  },
  (t) => [index('saved_searches_user_idx').on(t.userId)],
);
