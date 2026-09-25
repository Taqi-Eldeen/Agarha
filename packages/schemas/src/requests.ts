import { z } from 'zod';
import { REPORT_REASONS } from './enums.js';

// Customer requests shared by the web/mobile forms and the API.
export const reportInputSchema = z.object({ listingId: z.uuid(), reason: z.enum(REPORT_REASONS), details: z.string().trim().max(1000).optional() });
export type ReportInput = z.input<typeof reportInputSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_format');
export const availabilityRequestInputSchema = z
  .object({ listingId: z.uuid(), startDate: isoDate, endDate: isoDate, note: z.string().trim().max(300).optional(), locale: z.enum(['ar', 'en']).default('ar') })
  .refine((r) => r.endDate >= r.startDate, { path: ['endDate'], message: 'end_before_start' });
export type AvailabilityRequestInput = z.input<typeof availabilityRequestInputSchema>;
