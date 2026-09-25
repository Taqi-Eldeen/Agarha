/* eslint-disable no-console */
// Local/staging seed: catalog + plans + synthetic dealers and cars (never real people or documents).
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import sharp from 'sharp';
import { eq } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { loadEnv } from '../src/config/env';
import { DB, type Database } from '../src/db/db';
import { dealers } from '../src/db/schema/dealers';
import { listingPhotos, listings } from '../src/db/schema/listings';
import { STORAGE, type Storage } from '../src/infra/storage/storage';
import { CatalogService } from '../src/modules/catalog';
import { DealersService } from '../src/modules/dealers';
import { UsersService } from '../src/modules/identity';
import { ListingsService } from '../src/modules/listings';
import { SearchService } from '../src/modules/search';
import { seedCatalog } from './seed-catalog';

const DEMO_DEALERS = [
  { ar: 'النيل لتأجير السيارات', en: 'Nile Car Rental', phone: '+201000000101', area: 'nasr-city', city: 'cairo' },
  { ar: 'مصر الجديدة ليموزين', en: 'Heliopolis Limousine', phone: '+201000000102', area: 'heliopolis', city: 'cairo' },
  { ar: 'زايد رنت', en: 'Zayed Rent', phone: '+201000000103', area: 'sheikh-zayed', city: 'giza' },
  { ar: 'المعادي كار', en: 'Maadi Car', phone: '+201000000104', area: 'maadi', city: 'cairo' },
];
const CARS: [make: string, model: string, year: number, day: number, deposit: number, seats: number, driver: 'self' | 'driver' | 'both'][] = [
  ['toyota', 'corolla', 2024, 1600, 5000, 5, 'self'],
  ['hyundai', 'elantra', 2023, 1400, 4000, 5, 'both'],
  ['kia', 'sportage', 2024, 2600, 8000, 5, 'self'],
  ['nissan', 'sunny', 2022, 950, 3000, 5, 'self'],
  ['toyota', 'hiace', 2021, 3200, 0, 14, 'driver'],
  ['mercedes-benz', 'e-class', 2023, 6500, 20000, 5, 'driver'],
  ['mg', 'zs', 2024, 1700, 5000, 5, 'both'],
  ['chevrolet', 'optra', 2022, 900, 3000, 5, 'self'],
];
const COLORS = ['#e8e8e8', '#222831', '#8d99ae', '#c1121f', '#1d3557'];

async function photo(color: string, label: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="100%" height="100%" fill="${color}"/><text x="80" y="920" font-size="72" font-family="sans-serif" fill="#ffffff" opacity="0.8">${label}</text></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();
}

async function main() {
  const env = loadEnv();
  if (env.APP_ENV === 'production') throw new Error('Refusing to seed production');
  const app = await NestFactory.createApplicationContext(AppModule.forRoot(env), { logger: ['error', 'warn'] });
  const db = app.get<Database>(DB);
  await seedCatalog(db);
  console.log('catalog + plans seeded');

  const users = app.get(UsersService, { strict: false });
  const dealerSvc = app.get(DealersService, { strict: false });
  const catalog = app.get(CatalogService, { strict: false });
  const listingSvc = app.get(ListingsService, { strict: false });
  const storage = app.get<Storage>(STORAGE, { strict: false });
  const search = app.get(SearchService, { strict: false });

  // Local admin for the admin console (dev-login with this email).
  const admin = await users.findOrCreateByPhone('+201000000001', 'en');
  await users.grantRoles(admin.id, ['admin']);
  await users.linkIdentity(admin.id, 'google_workspace', 'dev:admin@agarha.com', 'admin@agarha.com');

  const makes = await catalog.makes();
  for (const [i, spec] of DEMO_DEALERS.entries()) {
    const owner = await users.findOrCreateByPhone(spec.phone, 'ar');
    const existing = await dealerSvc.memberships(owner.id);
    if (existing.length) continue;
    const actor = { userId: owner.id, role: 'dealer_owner' as const };
    const d = await dealerSvc.createBusiness(owner.id, { legalName: `${spec.en} LLC`, displayNameAr: spec.ar, displayNameEn: spec.en, commercialRegistrationNo: `CR-${1000 + i}`, taxCardNo: `100-200-30${i}`, phone: spec.phone, whatsapp: spec.phone }, actor);
    const city = await catalog.cityBySlug(spec.city);
    const area = (await catalog.areas(city.id)).find((a) => a.slug === spec.area)!;
    const branch = await dealerSvc.saveBranch(d.id, { areaId: area.id, nameAr: `فرع ${area.nameAr}`, nameEn: `${area.nameEn} branch`, lat: (area.lat ?? 30.04) + 0.004 * i, lng: (area.lng ?? 31.23) - 0.003 * i, isPrimary: true }, actor);
    await db.update(dealers).set({ status: 'verified', verifiedAt: new Date() }).where(eq(dealers.id, d.id));
    for (const [j, [makeSlug, modelSlug, year, day, deposit, seats, driver]] of CARS.entries()) {
      if ((i + j) % 2 === 1 && j > 3) continue;
      const make = makes.find((m) => m.slug === makeSlug)!;
      const model = (await catalog.models(make.id)).find((m) => m.slug === modelSlug)!;
      const l = await listingSvc.create(d.id, { carModelId: model.id, branchId: branch.id, year, color: 'white', transmission: j === 7 ? 'manual' : 'automatic', fuel: 'petrol', seats, driverOption: driver, priceDayEgp: day + i * 50, priceWeekEgp: (day + i * 50) * 6, priceMonthEgp: (day + i * 50) * 22, depositEgp: deposit, minAge: 23, requiredDocs: ['national_id', 'egyptian_driving_licence'], kmLimitPerDay: 250, deliveryOptions: ['branch_pickup', 'home_delivery'], airportPickup: j % 3 === 0 }, actor);
      for (let k = 0; k < 2; k++) {
        const key = `listings/${l.id}/seed-${k}/upload`;
        await storage.put('private', key, await photo(COLORS[(j + k) % COLORS.length]!, `${make.nameEn} ${model.nameEn} ${year}`), 'image/jpeg');
        const [p] = await db.insert(listingPhotos).values({ listingId: l.id, position: k, status: 'processing', storageKey: key }).returning();
        await listingSvc.processPhoto(p!.id);
      }
      await db.update(listings).set({ status: 'live', publishedAt: new Date(), reviewedAt: new Date(), lastConfirmedAt: new Date(Date.now() - j * 20 * 3_600_000) }).where(eq(listings.id, l.id));
    }
    console.log(`dealer ${spec.en} seeded`);
  }
  console.log(await search.reindexAll());
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
