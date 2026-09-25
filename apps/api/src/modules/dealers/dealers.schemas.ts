import { z } from 'zod';

// Shared with the web forms (React Hook Form) so client and server validate identically.
export { branchInputSchema as branchSchema, businessSchema, inviteSchema, profileSchema } from '@agarha/schemas';
export const reasonSchema = z.object({ reason: z.string().trim().min(3).max(500) });
export const directoryQuerySchema = z.object({ city: z.string().max(60).optional(), cursor: z.string().max(200).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) });
export const adminDealerQuerySchema = z.object({
  status: z.enum(['onboarding', 'pending_review', 'verified', 'rejected', 'suspended']).optional(),
  q: z.string().max(80).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
