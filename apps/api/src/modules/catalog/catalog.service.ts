import { normalizeArabic } from '@agarha/schemas';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import { DB, type Database } from '../../db/db';
import { areas, carMakes, carModels, carTrims, cities } from '../../db/schema/catalog';
import { Errors } from '../../common/errors';

const point = (lng: number, lat: number) => sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;
const lngLat = (col: typeof cities.center | typeof areas.center) => ({
  lng: sql<number | null>`ST_X(${col})`,
  lat: sql<number | null>`ST_Y(${col})`,
});

export interface GeoInput {
  lat?: number | null | undefined;
  lng?: number | null | undefined;
}

@Injectable()
export class CatalogService {
  constructor(@Inject(DB) private readonly db: Database) {}

  cities(includeInactive = false) {
    return this.db
      .select({ id: cities.id, slug: cities.slug, nameAr: cities.nameAr, nameEn: cities.nameEn, isActive: cities.isActive, ...lngLat(cities.center) })
      .from(cities)
      .where(includeInactive ? undefined : eq(cities.isActive, true))
      .orderBy(asc(cities.sortOrder), asc(cities.nameEn));
  }

  async cityBySlug(slug: string) {
    const [c] = await this.db.select({ id: cities.id, slug: cities.slug, nameAr: cities.nameAr, nameEn: cities.nameEn, isActive: cities.isActive, ...lngLat(cities.center) }).from(cities).where(eq(cities.slug, slug));
    if (!c) throw Errors.notFound('City');
    return c;
  }

  areas(cityId: string) {
    return this.db
      .select({ id: areas.id, cityId: areas.cityId, slug: areas.slug, nameAr: areas.nameAr, nameEn: areas.nameEn, ...lngLat(areas.center) })
      .from(areas)
      .where(eq(areas.cityId, cityId))
      .orderBy(asc(areas.nameEn));
  }

  async area(id: string) {
    const [a] = await this.db
      .select({ id: areas.id, slug: areas.slug, nameAr: areas.nameAr, nameEn: areas.nameEn, cityId: cities.id, citySlug: cities.slug, cityNameAr: cities.nameAr, cityNameEn: cities.nameEn, cityActive: cities.isActive })
      .from(areas)
      .innerJoin(cities, eq(cities.id, areas.cityId))
      .where(eq(areas.id, id));
    return a ?? null;
  }

  makes() {
    return this.db.select().from(carMakes).orderBy(asc(carMakes.nameEn));
  }

  models(makeId: string) {
    return this.db
      .select({ id: carModels.id, makeId: carModels.makeId, slug: carModels.slug, nameAr: carModels.nameAr, nameEn: carModels.nameEn, bodyType: carModels.bodyType })
      .from(carModels)
      .where(eq(carModels.makeId, makeId))
      .orderBy(asc(carModels.nameEn));
  }

  trims(modelId: string) {
    return this.db.select().from(carTrims).where(eq(carTrims.modelId, modelId)).orderBy(asc(carTrims.nameEn));
  }

  async model(id: string) {
    const [m] = await this.db
      .select({ id: carModels.id, slug: carModels.slug, nameAr: carModels.nameAr, nameEn: carModels.nameEn, bodyType: carModels.bodyType, makeId: carMakes.id, makeSlug: carMakes.slug, makeNameAr: carMakes.nameAr, makeNameEn: carMakes.nameEn })
      .from(carModels)
      .innerJoin(carMakes, eq(carMakes.id, carModels.makeId))
      .where(eq(carModels.id, id));
    return m ?? null;
  }

  /** Autocomplete for the search box: models and areas, Arabic-normalised trigram match. */
  async suggest(q: string, limit = 8) {
    const n = normalizeArabic(q);
    if (n.length < 2) return { models: [], areas: [] };
    const models = await this.db
      .select({ id: carModels.id, slug: carModels.slug, nameAr: carModels.nameAr, nameEn: carModels.nameEn, makeNameAr: carMakes.nameAr, makeNameEn: carMakes.nameEn })
      .from(carModels)
      .innerJoin(carMakes, eq(carMakes.id, carModels.makeId))
      .where(sql`${carModels.searchText} % ${n} OR ${carModels.searchText} LIKE ${'%' + n + '%'}`)
      .orderBy(sql`similarity(${carModels.searchText}, ${n}) DESC`)
      .limit(limit);
    const areaRows = await this.db
      .select({ id: areas.id, slug: areas.slug, nameAr: areas.nameAr, nameEn: areas.nameEn, citySlug: cities.slug })
      .from(areas)
      .innerJoin(cities, and(eq(cities.id, areas.cityId), eq(cities.isActive, true)))
      .where(sql`${areas.searchText} % ${n} OR ${areas.searchText} LIKE ${'%' + n + '%'}`)
      .orderBy(sql`similarity(${areas.searchText}, ${n}) DESC`)
      .limit(limit);
    return { models, areas: areaRows };
  }

  // --- admin writes -------------------------------------------------------
  async upsertCity(v: { id?: string; slug: string; nameAr: string; nameEn: string; isActive: boolean; sortOrder: number } & GeoInput) {
    const values = { slug: v.slug, nameAr: v.nameAr, nameEn: v.nameEn, isActive: v.isActive, sortOrder: v.sortOrder, center: v.lat != null && v.lng != null ? point(v.lng, v.lat) : null };
    if (v.id) return (await this.db.update(cities).set(values as never).where(eq(cities.id, v.id)).returning({ id: cities.id }))[0];
    return (await this.db.insert(cities).values(values as never).returning({ id: cities.id }))[0];
  }
  async upsertArea(v: { id?: string; cityId: string; slug: string; nameAr: string; nameEn: string } & GeoInput) {
    const values = { cityId: v.cityId, slug: v.slug, nameAr: v.nameAr, nameEn: v.nameEn, center: v.lat != null && v.lng != null ? point(v.lng, v.lat) : null };
    if (v.id) return (await this.db.update(areas).set(values as never).where(eq(areas.id, v.id)).returning({ id: areas.id }))[0];
    return (await this.db.insert(areas).values(values as never).returning({ id: areas.id }))[0];
  }
  async upsertMake(v: { id?: string; slug: string; nameAr: string; nameEn: string }) {
    const { id, ...values } = v;
    if (id) return (await this.db.update(carMakes).set(values).where(eq(carMakes.id, id)).returning({ id: carMakes.id }))[0];
    return (await this.db.insert(carMakes).values(values).returning({ id: carMakes.id }))[0];
  }
  async upsertModel(v: { id?: string; makeId: string; slug: string; nameAr: string; nameEn: string; bodyType: typeof carModels.$inferInsert.bodyType }) {
    const { id, ...values } = v;
    if (id) return (await this.db.update(carModels).set(values).where(eq(carModels.id, id)).returning({ id: carModels.id }))[0];
    return (await this.db.insert(carModels).values(values).returning({ id: carModels.id }))[0];
  }
  async upsertTrim(v: { id?: string; modelId: string; slug: string; nameAr: string; nameEn: string }) {
    const { id, ...values } = v;
    if (id) return (await this.db.update(carTrims).set(values).where(eq(carTrims.id, id)).returning({ id: carTrims.id }))[0];
    return (await this.db.insert(carTrims).values(values).returning({ id: carTrims.id }))[0];
  }
}
