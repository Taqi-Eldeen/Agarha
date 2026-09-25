import { egyptMobileSchema, egyptPhoneSchema } from '@agarha/schemas';
import { z } from 'zod';

export const businessSchema = z.object({
  legalName: z.string().trim().min(2).max(120),
  displayNameAr: z.string().trim().min(2).max(60),
  displayNameEn: z.string().trim().min(2).max(60),
  descriptionAr: z.string().trim().max(1000).optional(),
  descriptionEn: z.string().trim().max(1000).optional(),
  commercialRegistrationNo: z.string().trim().regex(/^[0-9A-Za-z\-/]{3,30}$/),
  taxCardNo: z.string().trim().regex(/^[0-9\-]{9,15}$/),
  phone: egyptPhoneSchema,
  whatsapp: egyptMobileSchema,
});
export const profileSchema = businessSchema.partial().omit({ legalName: true, commercialRegistrationNo: true, taxCardNo: true });

export const branchSchema = z
  .object({
    areaId: z.uuid(),
    nameAr: z.string().trim().min(1).max(80),
    nameEn: z.string().trim().min(1).max(80),
    addressAr: z.string().trim().max(200).optional(),
    addressEn: z.string().trim().max(200).optional(),
    lat: z.number().min(21).max(32).optional(),
    lng: z.number().min(24).max(37).optional(),
    phone: egyptPhoneSchema.optional(),
    whatsapp: egyptMobileSchema.optional(),
    isPrimary: z.boolean().default(false),
  })
  .refine((b) => (b.lat === undefined) === (b.lng === undefined), { path: ['lat'], message: 'lat_and_lng_together' });

export const inviteSchema = z.object({ phone: egyptMobileSchema, role: z.enum(['dealer_staff', 'dealer_owner']).default('dealer_staff') });
export const reasonSchema = z.object({ reason: z.string().trim().min(3).max(500) });
export const directoryQuerySchema = z.object({ city: z.string().max(60).optional(), cursor: z.string().max(200).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) });
export const adminDealerQuerySchema = z.object({
  status: z.enum(['onboarding', 'pending_review', 'verified', 'rejected', 'suspended']).optional(),
  q: z.string().max(80).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
