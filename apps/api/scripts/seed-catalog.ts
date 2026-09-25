import { sql } from 'drizzle-orm';
import type { Database } from '../src/db/db';
import { areas, carMakes, carModels, cities } from '../src/db/schema/catalog';
import { plans } from '../src/db/schema/billing';
import { CITIES, MAKES, PLANS } from './seed-data';

const pt = (lng: number, lat: number) => sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;

/** Idempotent: safe to run on every deploy. */
export async function seedCatalog(db: Database): Promise<void> {
  for (const c of CITIES) {
    const [city] = await db
      .insert(cities)
      .values({
        slug: c.slug,
        nameAr: c.ar,
        nameEn: c.en,
        isActive: c.active,
        sortOrder: c.sort,
        center: pt(c.lng, c.lat) as never,
      })
      .onConflictDoUpdate({ target: cities.slug, set: { nameAr: c.ar, nameEn: c.en } })
      .returning({ id: cities.id });
    for (const [slug, ar, en, lat, lng] of c.areas)
      await db
        .insert(areas)
        .values({ cityId: city!.id, slug, nameAr: ar, nameEn: en, center: pt(lng, lat) as never })
        .onConflictDoUpdate({
          target: [areas.cityId, areas.slug],
          set: { nameAr: ar, nameEn: en },
        });
  }
  for (const m of MAKES) {
    const [make] = await db
      .insert(carMakes)
      .values({ slug: m.slug, nameAr: m.ar, nameEn: m.en })
      .onConflictDoUpdate({ target: carMakes.slug, set: { nameAr: m.ar, nameEn: m.en } })
      .returning({ id: carMakes.id });
    for (const [slug, ar, en, body] of m.models)
      await db
        .insert(carModels)
        .values({ makeId: make!.id, slug, nameAr: ar, nameEn: en, bodyType: body })
        .onConflictDoUpdate({
          target: [carModels.makeId, carModels.slug],
          set: { nameAr: ar, nameEn: en, bodyType: body },
        });
  }
  for (const p of PLANS) await db.insert(plans).values(p).onConflictDoNothing();
}
