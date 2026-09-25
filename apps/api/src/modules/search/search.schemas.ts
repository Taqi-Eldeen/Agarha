import { CAR_BODY_TYPES, DRIVER_OPTIONS, PRICE_PERIODS, TRANSMISSIONS } from '@agarha/schemas';
import { z } from 'zod';

const bool = z.union([
  z.boolean(),
  z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1'),
]);
const num = z.coerce.number();

export const searchQuerySchema = z.object({
  city: z.string().max(60).optional(),
  area: z.string().max(60).optional(),
  type: z.enum(CAR_BODY_TYPES).optional(),
  make: z.string().max(60).optional(),
  q: z.string().trim().max(80).optional(),
  period: z.enum(PRICE_PERIODS).default('day'),
  priceMin: num.int().min(0).optional(),
  priceMax: num.int().min(0).optional(),
  transmission: z.enum(TRANSMISSIONS).optional(),
  seatsMin: num.int().min(2).max(15).optional(),
  /** "self" matches self-drive and both; "driver" matches with-driver and both. */
  driver: z.enum(DRIVER_OPTIONS).optional(),
  airport: bool.optional(),
  includeUnavailable: bool.default(false),
  dealerId: z.uuid().optional(),
  /** "near me": lat,lng + radius km */
  lat: num.min(21).max(32).optional(),
  lng: num.min(24).max(37).optional(),
  radiusKm: num.min(1).max(100).default(15),
  /** Map "search this area": minLng,minLat,maxLng,maxLat */
  bbox: z
    .string()
    .regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/)
    .transform((s) => s.split(',').map(Number) as [number, number, number, number])
    .optional(),
  sort: z.enum(['relevance', 'price_asc', 'price_desc', 'newest', 'distance']).default('relevance'),
  cursor: z.string().max(400).optional(),
  limit: num.int().min(1).max(50).default(20),
});
export type SearchQuery = z.output<typeof searchQuerySchema>;

export const savedSearchSchema = z.object({
  name: z.string().trim().max(60).optional(),
  query: searchQuerySchema.omit({ cursor: true, limit: true, sort: true }).partial(),
  alertsEnabled: z.boolean().default(true),
});
export const savedSearchPatchSchema = z.object({
  name: z.string().trim().max(60).optional(),
  alertsEnabled: z.boolean().optional(),
});
