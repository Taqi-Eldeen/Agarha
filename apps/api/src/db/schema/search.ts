// Owned by the search module.

import { boolean, geometry, index, integer, jsonb, pgTable, smallint, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, tstz } from './_columns';
import { carBodyTypeEnum, driverOptionEnum, fuelEnum, transmissionEnum } from './enums';
import { users } from './identity';

export const savedSearches = pgTable(
  'saved_searches',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name'),
    /** Validated search query (same shape as GET /v1/search params). */
    query: jsonb('query').notNull(),
    alertsEnabled: boolean('alerts_enabled').notNull().default(true),
    lastNotifiedAt: tstz('last_notified_at'),
    createdAt: createdAt(),
  },
  (t) => [index('saved_searches_user_idx').on(t.userId)],
);

/**
 * Search projection: one denormalised row per publicly visible listing, rebuilt from the
 * listings / dealers / catalog services on domain events. The Postgres search engine queries
 * this table; the Meilisearch adapter indexes the same documents.
 */
export const searchDocuments = pgTable(
  'search_documents',
  {
    listingId: uuid('listing_id').primaryKey(),
    dealerId: uuid('dealer_id').notNull(),
    available: boolean('available').notNull(),
    citySlug: text('city_slug').notNull(),
    areaSlug: text('area_slug').notNull(),
    bodyType: carBodyTypeEnum('body_type').notNull(),
    makeSlug: text('make_slug').notNull(),
    modelSlug: text('model_slug').notNull(),
    transmission: transmissionEnum('transmission').notNull(),
    fuel: fuelEnum('fuel').notNull(),
    seats: smallint('seats').notNull(),
    year: smallint('year').notNull(),
    driverOption: driverOptionEnum('driver_option').notNull(),
    airportPickup: boolean('airport_pickup').notNull(),
    priceDay: integer('price_day').notNull(),
    /** Effective period prices: explicit price or day × 7 / × 30. */
    priceWeek: integer('price_week').notNull(),
    priceMonth: integer('price_month').notNull(),
    deposit: integer('deposit').notNull(),
    featuredUntil: tstz('featured_until'),
    lastConfirmedAt: tstz('last_confirmed_at').notNull(),
    publishedAt: tstz('published_at').notNull(),
    location: geometry('location', { type: 'point', mode: 'xy', srid: 4326 }),
    searchText: text('search_text').notNull(),
    /** Everything a listing card needs, so results render without further queries. */
    card: jsonb('card').notNull(),
    indexedAt: tstz('indexed_at').notNull().defaultNow(),
  },
  (t) => [
    index('search_documents_city_idx').on(t.citySlug, t.areaSlug),
    index('search_documents_price_idx').on(t.priceDay),
    index('search_documents_confirmed_idx').on(t.lastConfirmedAt),
    index('search_documents_location_gist').using('gist', t.location),
    index('search_documents_text_trgm').using('gin', t.searchText.op('gin_trgm_ops')),
    index('search_documents_dealer_idx').on(t.dealerId),
  ],
);

