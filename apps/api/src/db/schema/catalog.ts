// Owned by the catalog module: geography and car reference data.
import { sql } from 'drizzle-orm';
import { boolean, geometry, index, integer, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id } from './_columns';
import { carBodyTypeEnum } from './enums';

/** ag_normalize_ar() is defined in migration 0000_extensions.sql. */
const searchText = (...cols: string[]) =>
  sql.raw(`ag_normalize_ar(${cols.map((c) => `coalesce(${c}, '')`).join(` || ' ' || `)})`);

export const cities = pgTable(
  'cities',
  {
    id: id(),
    slug: text('slug').notNull(),
    nameAr: text('name_ar').notNull(),
    nameEn: text('name_en').notNull(),
    searchText: text('search_text').generatedAlwaysAs(searchText('name_ar', 'name_en')),
    center: geometry('center', { type: 'point', mode: 'xy', srid: 4326 }),
    isActive: boolean('is_active').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('cities_slug_key').on(t.slug),
    index('cities_search_trgm_idx').using('gin', t.searchText.op('gin_trgm_ops')),
  ],
);

export const areas = pgTable(
  'areas',
  {
    id: id(),
    cityId: uuid('city_id').notNull().references(() => cities.id),
    slug: text('slug').notNull(),
    nameAr: text('name_ar').notNull(),
    nameEn: text('name_en').notNull(),
    searchText: text('search_text').generatedAlwaysAs(searchText('name_ar', 'name_en')),
    center: geometry('center', { type: 'point', mode: 'xy', srid: 4326 }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('areas_city_slug_key').on(t.cityId, t.slug),
    index('areas_search_trgm_idx').using('gin', t.searchText.op('gin_trgm_ops')),
  ],
);

export const carMakes = pgTable(
  'car_makes',
  {
    id: id(),
    slug: text('slug').notNull(),
    nameAr: text('name_ar').notNull(),
    nameEn: text('name_en').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('car_makes_slug_key').on(t.slug)],
);

export const carModels = pgTable(
  'car_models',
  {
    id: id(),
    makeId: uuid('make_id').notNull().references(() => carMakes.id),
    slug: text('slug').notNull(),
    nameAr: text('name_ar').notNull(),
    nameEn: text('name_en').notNull(),
    bodyType: carBodyTypeEnum('body_type').notNull(),
    /** Denormalised make + model names, Arabic-normalised, for fuzzy search. */
    searchText: text('search_text').notNull().default(''),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('car_models_make_slug_key').on(t.makeId, t.slug),
    index('car_models_search_trgm_idx').using('gin', t.searchText.op('gin_trgm_ops')),
  ],
);
