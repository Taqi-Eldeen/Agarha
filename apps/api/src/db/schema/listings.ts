// Owned by the listings module (media owns listing_photos processing state, but the table is keyed here).
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, id, tstz, updatedAt } from './_columns';
import { carModels, carTrims } from './catalog';
import { users } from './identity';
import { branches, dealers } from './dealers';
import {
  deliveryOptionEnum,
  driverOptionEnum,
  fuelEnum,
  listingStatusEnum,
  mediaStatusEnum,
  requiredDocEnum,
  transmissionEnum,
  importStatusEnum,
} from './enums';

export const listings = pgTable(
  'listings',
  {
    id: id(),
    /** Denormalised from branch for the dealer policy layer / RLS; kept consistent by a composite FK. */
    dealerId: uuid('dealer_id')
      .notNull()
      .references(() => dealers.id),
    branchId: uuid('branch_id').notNull(),
    carModelId: uuid('car_model_id')
      .notNull()
      .references(() => carModels.id),
    trimId: uuid('trim_id').references(() => carTrims.id),
    /** Set when a moderator has reviewed a listing that went live without pre-approval. */
    reviewedAt: tstz('reviewed_at'),
    slug: text('slug').notNull(),
    status: listingStatusEnum('status').notNull().default('draft'),
    available: boolean('available').notNull().default(true),
    lastConfirmedAt: tstz('last_confirmed_at').notNull().defaultNow(),
    transmission: transmissionEnum('transmission').notNull(),
    seats: smallint('seats').notNull(),
    fuel: fuelEnum('fuel').notNull(),
    year: smallint('year').notNull(),
    color: text('color').notNull(),
    driverOption: driverOptionEnum('driver_option').notNull(),
    minAge: smallint('min_age').notNull(),
    requiredDocs: requiredDocEnum('required_docs').array().notNull(),
    /** null = unlimited km. */
    kmLimitPerDay: integer('km_limit_per_day'),
    deliveryOptions: deliveryOptionEnum('delivery_options')
      .array()
      .notNull()
      .default(sql`'{branch_pickup}'`),
    airportPickup: boolean('airport_pickup').notNull().default(false),
    descriptionAr: text('description_ar'),
    descriptionEn: text('description_en'),
    featuredUntil: tstz('featured_until'),
    publishedAt: tstz('published_at'),
    hiddenReason: text('hidden_reason'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      name: 'listings_branch_dealer_fk',
      columns: [t.branchId, t.dealerId],
      foreignColumns: [branches.id, branches.dealerId],
    }),
    index('listings_dealer_idx').on(t.dealerId),
    index('listings_branch_idx').on(t.branchId),
    index('listings_model_idx').on(t.carModelId),
    // Hot path for search and the hourly freshness job.
    index('listings_live_confirmed_idx')
      .on(t.lastConfirmedAt)
      .where(sql`${t.status} = 'live'`),
    check('listings_seats_range', sql`${t.seats} between 2 and 15`),
    check('listings_min_age_range', sql`${t.minAge} between 18 and 35`),
    check('listings_year_range', sql`${t.year} between 1990 and 2100`),
    check('listings_required_docs_nonempty', sql`cardinality(${t.requiredDocs}) > 0`),
    check('listings_km_limit_nonneg', sql`${t.kmLimitPerDay} is null or ${t.kmLimitPerDay} >= 0`),
  ],
);

/** 1–1 with listings. Whole EGP; deposit is always shown separately from price (A3). */
export const listingPrices = pgTable(
  'listing_prices',
  {
    listingId: uuid('listing_id')
      .primaryKey()
      .references(() => listings.id, { onDelete: 'cascade' }),
    priceDayEgp: integer('price_day_egp').notNull(),
    priceWeekEgp: integer('price_week_egp'),
    priceMonthEgp: integer('price_month_egp'),
    depositEgp: integer('deposit_egp').notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('listing_prices_day_positive', sql`${t.priceDayEgp} > 0`),
    check('listing_prices_week_positive', sql`${t.priceWeekEgp} is null or ${t.priceWeekEgp} > 0`),
    check(
      'listing_prices_month_positive',
      sql`${t.priceMonthEgp} is null or ${t.priceMonthEgp} > 0`,
    ),
    check('listing_prices_deposit_nonneg', sql`${t.depositEgp} >= 0`),
    index('listing_prices_day_idx').on(t.priceDayEgp),
  ],
);

export const listingPhotos = pgTable(
  'listing_photos',
  {
    id: id(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    status: mediaStatusEnum('status').notNull().default('pending_upload'),
    /** Original object key in public-media (EXIF-stripped copy replaces it after processing). */
    storageKey: text('storage_key').notNull(),
    width: integer('width'),
    height: integer('height'),
    blurhash: text('blurhash'),
    /** { webp: { 320: key, 640: key, 1280: key }, avif: {...} } */
    variants:
      jsonb('variants').$type<Record<'webp' | 'avif', Record<'320' | '640' | '1280', string>>>(),
    createdAt: createdAt(),
  },
  (t) => [
    // Unique (listing_id, position) is a DEFERRABLE constraint added in migration 0004 (drizzle can't express it).
    index('listing_photos_listing_idx').on(t.listingId, t.position),
    check('listing_photos_max_12', sql`${t.position} between 0 and 11`),
  ],
);

export const favorites = pgTable(
  'favorites',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.listingId] })],
);

/** Phase 6: CSV fleet import. Rows are validated first, then applied in one transaction. */
export const listingImports = pgTable('listing_imports', {
  id: id(),
  dealerId: uuid('dealer_id')
    .notNull()
    .references(() => dealers.id),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  status: importStatusEnum('status').notNull().default('validating'),
  rowCount: integer('row_count').notNull().default(0),
  errors: jsonb('errors').$type<{ row: number; field: string; code: string }[]>(),
  /** Validated rows, applied as drafts in one go. Stored so any API instance can apply. */
  rows: jsonb('rows').$type<unknown[]>(),
  appliedAt: tstz('applied_at'),
  createdAt: createdAt(),
});
