import { listingFactsSchema } from '@agarha/schemas';
import { z } from 'zod';

const base = listingFactsSchema;
export const createListingSchema = z.intersection(
  base,
  z.object({
    trimId: z.uuid().nullable().optional(),
    descriptionAr: z.string().trim().max(2000).optional(),
    descriptionEn: z.string().trim().max(2000).optional(),
  }),
);
export type CreateListing = z.output<typeof createListingSchema>;

export const updateListingSchema = createListingSchema;
export const availabilitySchema = z.object({ available: z.boolean() });
export const photoUploadSchema = z.object({
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  sizeBytes: z
    .number()
    .int()
    .min(1)
    .max(10 * 1024 * 1024),
});
export const reorderSchema = z.object({ photoIds: z.array(z.uuid()).min(1).max(12) });
export const fleetQuerySchema = z.object({
  status: z.enum(['draft', 'pending', 'live', 'paused', 'hidden', 'archived']).optional(),
  cursor: z.string().max(300).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const adminListingQuerySchema = z.object({
  queue: z.enum(['pending', 'unreviewed', 'hidden', 'all']).default('pending'),
  dealerId: z.uuid().optional(),
  cursor: z.string().max(300).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const moderationSchema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('approve') }),
  z.object({ decision: z.literal('reject'), reason: z.string().trim().min(3).max(300) }),
  z.object({ decision: z.literal('hide'), reason: z.string().trim().min(3).max(300) }),
]);
