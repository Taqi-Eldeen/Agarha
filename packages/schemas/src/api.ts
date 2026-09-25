// Response shapes shared by the API (OpenAPI annotations), the generated client, web and mobile.
import { z } from 'zod';
import { CAR_BODY_TYPES, DRIVER_OPTIONS, LEAD_CHANNELS, LISTING_STATUSES, REQUIRED_DOCS, TRANSMISSIONS } from './enums.js';

const localized = z.object({ ar: z.string(), en: z.string() });

export const listingCardSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  photo: z.object({ url320: z.string().nullable(), url640: z.string().nullable(), blurhash: z.string().nullable() }).nullable(),
  photoCount: z.number().int(),
  make: localized,
  model: localized,
  bodyType: z.enum(CAR_BODY_TYPES),
  year: z.number().int(),
  transmission: z.enum(TRANSMISSIONS),
  seats: z.number().int(),
  driverOption: z.enum(DRIVER_OPTIONS),
  prices: z.object({ day: z.number(), week: z.number().nullable(), month: z.number().nullable(), deposit: z.number() }),
  requiredDocs: z.array(z.enum(REQUIRED_DOCS)),
  minAge: z.number().int(),
  kmLimitPerDay: z.number().int().nullable(),
  airportPickup: z.boolean(),
  lastConfirmedAt: z.string(),
  available: z.boolean(),
  featured: z.boolean(),
  dealer: z.object({ id: z.uuid(), slug: z.string(), nameAr: z.string(), nameEn: z.string(), verified: z.boolean(), whatsapp: z.string(), phone: z.string() }),
  area: z.object({ slug: z.string(), ar: z.string(), en: z.string() }),
  city: z.object({ slug: z.string(), ar: z.string(), en: z.string() }),
  location: z.object({ lat: z.number(), lng: z.number() }).nullable(),
});
export type ListingCard = z.infer<typeof listingCardSchema>;

export const searchResultSchema = z.object({
  items: z.array(z.object({ card: listingCardSchema, distanceKm: z.number().optional() })),
  nextCursor: z.string().nullable(),
  total: z.number().int(),
});
export type SearchResult = z.infer<typeof searchResultSchema>;

export const mapPinsSchema = z.object({ items: z.array(z.object({ id: z.uuid(), lat: z.number(), lng: z.number(), price: z.number(), featured: z.boolean() })) });
export type MapPins = z.infer<typeof mapPinsSchema>;

const photoSchema = z.object({
  id: z.uuid(),
  position: z.number().int(),
  status: z.enum(['pending_upload', 'processing', 'ready', 'rejected']),
  width: z.number().nullable(),
  height: z.number().nullable(),
  blurhash: z.string().nullable(),
  urls: z.record(z.enum(['webp', 'avif']), z.record(z.enum(['320', '640', '1280']), z.string())).nullable(),
});
export type ListingPhoto = z.infer<typeof photoSchema>;

export const listingSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  dealerId: z.uuid(),
  branchId: z.uuid(),
  carModelId: z.uuid(),
  trimId: z.uuid().nullable(),
  status: z.enum(LISTING_STATUSES),
  available: z.boolean(),
  lastConfirmedAt: z.string(),
  freshness: z.enum(['fresh', 'aging', 'stale', 'expired']),
  freshnessScore: z.number(),
  transmission: z.enum(TRANSMISSIONS),
  seats: z.number(),
  fuel: z.string(),
  year: z.number(),
  color: z.string(),
  driverOption: z.enum(DRIVER_OPTIONS),
  minAge: z.number(),
  requiredDocs: z.array(z.enum(REQUIRED_DOCS)),
  kmLimitPerDay: z.number().nullable(),
  deliveryOptions: z.array(z.string()),
  airportPickup: z.boolean(),
  descriptionAr: z.string().nullable(),
  descriptionEn: z.string().nullable(),
  featured: z.boolean(),
  featuredUntil: z.string().nullable(),
  hiddenReason: z.string().nullable(),
  publishedAt: z.string().nullable(),
  updatedAt: z.string(),
  prices: z.object({ day: z.number(), week: z.number().nullable(), month: z.number().nullable(), deposit: z.number() }),
  photos: z.array(photoSchema),
});
export type Listing = z.infer<typeof listingSchema>;

const modelRef = z.object({ id: z.uuid(), slug: z.string(), nameAr: z.string(), nameEn: z.string(), bodyType: z.enum(CAR_BODY_TYPES), makeId: z.uuid(), makeSlug: z.string(), makeNameAr: z.string(), makeNameEn: z.string() });
export type ModelRef = z.infer<typeof modelRef>;

export const listingDetailSchema = z.object({
  listing: listingSchema.extend({ model: modelRef.nullable() }),
  card: listingCardSchema,
  dealer: z.object({
    id: z.uuid(),
    slug: z.string(),
    nameAr: z.string(),
    nameEn: z.string(),
    verified: z.boolean(),
    verifiedAt: z.string().nullable(),
    memberSince: z.string(),
    reviews: z.object({ count: z.number(), average: z.number().nullable() }),
    responseRate: z.number().nullable(),
  }),
  similar: z.array(listingCardSchema),
  safety: z.object({ neverPayDepositBeforeSeeing: z.boolean(), agarhaIsNotAParty: z.boolean() }),
});
export type ListingDetail = z.infer<typeof listingDetailSchema>;

export const reviewSchema = z.object({ id: z.uuid(), rating: z.number(), body: z.string().nullable(), dealerReply: z.string().nullable(), dealerRepliedAt: z.string().nullable(), createdAt: z.string() });
export type Review = z.infer<typeof reviewSchema>;

export const branchSchema = z.object({
  id: z.uuid(),
  dealerId: z.uuid(),
  areaId: z.uuid(),
  nameAr: z.string(),
  nameEn: z.string(),
  addressAr: z.string().nullable(),
  addressEn: z.string().nullable(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  isPrimary: z.boolean(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
});
export type Branch = z.infer<typeof branchSchema>;

export const dealerProfileSchema = z.object({
  dealer: z.object({ id: z.uuid(), slug: z.string(), nameAr: z.string(), nameEn: z.string(), descriptionAr: z.string().nullable(), descriptionEn: z.string().nullable(), verified: z.boolean(), verifiedAt: z.string().nullable(), memberSince: z.string(), whatsapp: z.string(), phone: z.string() }),
  branches: z.array(branchSchema.extend({ area: z.object({ nameAr: z.string(), nameEn: z.string(), citySlug: z.string(), cityNameAr: z.string(), cityNameEn: z.string(), slug: z.string() }).nullable() })),
  reviews: z.object({ count: z.number(), average: z.number().nullable(), latest: z.array(reviewSchema) }),
  responseRate: z.number().nullable(),
  fleet: z.array(listingCardSchema),
  fleetTotal: z.number(),
});
export type DealerProfile = z.infer<typeof dealerProfileSchema>;

export const dealerDirectorySchema = z.object({
  items: z.array(z.object({ id: z.uuid(), slug: z.string(), nameAr: z.string(), nameEn: z.string(), verified: z.boolean(), branchCount: z.number(), reviews: z.object({ count: z.number(), average: z.number().nullable() }) })),
  nextCursor: z.string().nullable(),
});

export const leadResponseSchema = z.object({ leadId: z.uuid(), refCode: z.string(), channel: z.enum(LEAD_CHANNELS), url: z.string() });
export type LeadResponse = z.infer<typeof leadResponseSchema>;

export const citySchema = z.object({ id: z.uuid(), slug: z.string(), nameAr: z.string(), nameEn: z.string(), isActive: z.boolean(), lat: z.number().nullable(), lng: z.number().nullable() });
export const areaSchema = z.object({ id: z.uuid(), cityId: z.uuid(), slug: z.string(), nameAr: z.string(), nameEn: z.string(), lat: z.number().nullable(), lng: z.number().nullable() });
export const makeSchema = z.object({ id: z.uuid(), slug: z.string(), nameAr: z.string(), nameEn: z.string() });
export const modelSchema = z.object({ id: z.uuid(), makeId: z.uuid(), slug: z.string(), nameAr: z.string(), nameEn: z.string(), bodyType: z.enum(CAR_BODY_TYPES) });
export type City = z.infer<typeof citySchema>;
export type Area = z.infer<typeof areaSchema>;
export type Make = z.infer<typeof makeSchema>;
export type CarModel = z.infer<typeof modelSchema>;

export const landingSchema = z.object({
  city: citySchema,
  area: areaSchema.nullable(),
  type: z.string().nullable(),
  areas: z.array(areaSchema.extend({ listings: z.number() })),
  types: z.array(z.object({ type: z.enum(CAR_BODY_TYPES), n: z.number(), min: z.number() })),
  stats: z.object({ n: z.number(), min: z.number().nullable(), max: z.number().nullable(), median: z.number().nullable() }),
  listings: z.array(listingCardSchema),
  total: z.number(),
});
export type Landing = z.infer<typeof landingSchema>;

export const sitemapSchema = z.object({
  generatedAt: z.string(),
  cities: z.array(z.string()),
  areas: z.array(z.object({ city: z.string(), area: z.string() })),
  types: z.array(z.object({ city: z.string(), type: z.string() })),
  listings: z.array(z.object({ id: z.string(), slug: z.string(), updatedAt: z.string() })),
  dealers: z.array(z.object({ slug: z.string(), updatedAt: z.string() })),
});
export type SitemapData = z.infer<typeof sitemapSchema>;

export const planSchema = z.object({ code: z.string(), nameAr: z.string(), nameEn: z.string(), priceMonthlyEgp: z.number(), maxLiveListings: z.number().nullable(), maxTeamMembers: z.number(), featuredCreditsPerMonth: z.number(), isActive: z.boolean(), sortOrder: z.number() });
export type Plan = z.infer<typeof planSchema>;

export const dealerStatsSchema = z.object({
  days: z.number(),
  totals: z.object({ views: z.number(), whatsapp: z.number(), calls: z.number(), conversion: z.number().nullable() }),
  freshnessScore: z.number().nullable(),
  daily: z.array(z.object({ day: z.string(), views: z.number(), contacts: z.number() })),
  cars: z.array(z.object({ listingId: z.uuid(), nameAr: z.string(), nameEn: z.string(), year: z.number(), status: z.string(), views: z.number(), whatsapp: z.number(), calls: z.number(), conversion: z.number().nullable(), freshnessScore: z.number(), lastConfirmedAt: z.string() })),
});
export type DealerStats = z.infer<typeof dealerStatsSchema>;

export const presignedUploadSchema = z.object({ url: z.string(), method: z.literal('PUT'), headers: z.record(z.string(), z.string()), expiresAt: z.string() });
export type PresignedUpload = z.infer<typeof presignedUploadSchema>;
