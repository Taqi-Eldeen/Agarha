import { z } from 'zod';
import {
  DELIVERY_OPTIONS,
  DRIVER_OPTIONS,
  FUELS,
  REQUIRED_DOCS,
  TRANSMISSIONS,
} from './enums.js';
import { egpAmountSchema, uuidSchema } from './common.js';

const currentYear = new Date().getFullYear();

/**
 * "Facts before contact": every field here is required on a live listing.
 * Weekly and monthly prices are optional; when missing the UI derives nothing and shows day price.
 */
export const listingFactsSchema = z
  .object({
    carModelId: uuidSchema,
    branchId: uuidSchema,
    year: z.number().int().min(1990).max(currentYear + 1),
    color: z.string().trim().min(1).max(40),
    transmission: z.enum(TRANSMISSIONS),
    fuel: z.enum(FUELS),
    seats: z.number().int().min(2).max(15),
    driverOption: z.enum(DRIVER_OPTIONS),
    priceDayEgp: egpAmountSchema.min(1),
    priceWeekEgp: egpAmountSchema.min(1).nullable().optional(),
    priceMonthEgp: egpAmountSchema.min(1).nullable().optional(),
    depositEgp: egpAmountSchema,
    minAge: z.number().int().min(18).max(35),
    requiredDocs: z.array(z.enum(REQUIRED_DOCS)).min(1),
    kmLimitPerDay: z.number().int().min(0).max(2000).nullable(),
    deliveryOptions: z.array(z.enum(DELIVERY_OPTIONS)).default(['branch_pickup']),
    airportPickup: z.boolean().default(false),
  })
  .refine((l) => l.priceWeekEgp == null || l.priceWeekEgp <= l.priceDayEgp * 7, {
    path: ['priceWeekEgp'],
    message: 'week_price_exceeds_seven_days',
  })
  .refine((l) => l.priceMonthEgp == null || l.priceMonthEgp <= l.priceDayEgp * 31, {
    path: ['priceMonthEgp'],
    message: 'month_price_exceeds_thirty_one_days',
  });
export type ListingFacts = z.infer<typeof listingFactsSchema>;
