// Owned by the billing module (Phase 5).
import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, tstz, updatedAt } from './_columns';
import { dealers } from './dealers';
import { invoiceStatusEnum, subscriptionStatusEnum } from './enums';
import { listings } from './listings';

/** Subscription tiers. Prices in whole EGP per month, VAT-inclusive. */
export const plans = pgTable(
  'plans',
  {
    code: text('code').primaryKey(),
    nameAr: text('name_ar').notNull(),
    nameEn: text('name_en').notNull(),
    priceMonthlyEgp: integer('price_monthly_egp').notNull(),
    maxLiveListings: integer('max_live_listings'),
    maxTeamMembers: integer('max_team_members').notNull().default(1),
    featuredCreditsPerMonth: integer('featured_credits_per_month').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
  },
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: id(),
    dealerId: uuid('dealer_id').notNull().references(() => dealers.id, { onDelete: 'cascade' }),
    planCode: text('plan_code')
      .notNull()
      .references(() => plans.code),
    featuredCreditsRemaining: integer('featured_credits_remaining').notNull().default(0),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    status: subscriptionStatusEnum('status').notNull(),
    currentPeriodEnd: tstz('current_period_end'),
    gateway: text('gateway'),
    gatewayRef: text('gateway_ref'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('subscriptions_dealer_key').on(t.dealerId)],
);

export const invoices = pgTable(
  'invoices',
  {
    id: id(),
    number: text('number').notNull(),
    dealerId: uuid('dealer_id')
      .notNull()
      .references(() => dealers.id),
    status: invoiceStatusEnum('status').notNull().default('open'),
    /** Whole EGP, VAT-inclusive; vat is the included 14% portion. */
    totalEgp: integer('total_egp').notNull(),
    vatEgp: integer('vat_egp').notNull(),
    lines: jsonb('lines').$type<{ kind: 'subscription' | 'featured'; description: string; amountEgp: number; ref?: string }[]>().notNull(),
    gateway: text('gateway'),
    gatewayRef: text('gateway_ref'),
    paidAt: tstz('paid_at'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('invoices_number_key').on(t.number), index('invoices_dealer_idx').on(t.dealerId, t.createdAt), uniqueIndex('invoices_gateway_ref_key').on(t.gateway, t.gatewayRef)],
);

export const featuredPlacements = pgTable(
  'featured_placements',
  {
    id: id(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    dealerId: uuid('dealer_id')
      .notNull()
      .references(() => dealers.id),
    startsAt: tstz('starts_at').notNull(),
    endsAt: tstz('ends_at').notNull(),
    invoiceId: uuid('invoice_id').references(() => invoices.id),
    createdAt: createdAt(),
  },
  (t) => [index('featured_placements_listing_idx').on(t.listingId, t.endsAt)],
);

/** Processed gateway webhook ids, so a replayed webhook is a no-op. */
export const paymentEvents = pgTable(
  'payment_events',
  {
    id: id(),
    gateway: text('gateway').notNull(),
    eventId: text('event_id').notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('payment_events_gateway_event_key').on(t.gateway, t.eventId)],
);
