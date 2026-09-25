import { z } from 'zod';
import { egyptMobileSchema, egyptPhoneSchema } from './common.js';

// Dealer forms: one schema validates the web form (React Hook Form) and the API body.
export const businessSchema = z.object({
  legalName: z.string().trim().min(2).max(120),
  displayNameAr: z.string().trim().min(2).max(60),
  displayNameEn: z.string().trim().min(2).max(60),
  descriptionAr: z.string().trim().max(1000).optional(),
  descriptionEn: z.string().trim().max(1000).optional(),
  commercialRegistrationNo: z.string().trim().regex(/^[0-9A-Za-z\-/]{3,30}$/, 'invalid_cr'),
  taxCardNo: z.string().trim().regex(/^[0-9\-]{9,15}$/, 'invalid_tax_card'),
  phone: egyptPhoneSchema,
  whatsapp: egyptMobileSchema,
});
export type BusinessInput = z.input<typeof businessSchema>;

export const profileSchema = businessSchema.partial().omit({ legalName: true, commercialRegistrationNo: true, taxCardNo: true });
export type ProfileInput = z.input<typeof profileSchema>;

export const branchInputSchema = z
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
export type BranchInput = z.input<typeof branchInputSchema>;

export const inviteSchema = z.object({ phone: egyptMobileSchema, role: z.enum(['dealer_staff', 'dealer_owner']).default('dealer_staff') });
export type InviteInput = z.input<typeof inviteSchema>;
