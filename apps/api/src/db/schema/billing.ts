// Owned by the billing module (Phase 5). Created now so the model is complete; unused until then.
import { pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, tstz, updatedAt } from './_columns';
import { dealers } from './dealers';
import { subscriptionStatusEnum } from './enums';

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: id(),
    dealerId: uuid('dealer_id').notNull().references(() => dealers.id, { onDelete: 'cascade' }),
    planCode: text('plan_code').notNull(),
    status: subscriptionStatusEnum('status').notNull(),
    currentPeriodEnd: tstz('current_period_end'),
    gateway: text('gateway'),
    gatewayRef: text('gateway_ref'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('subscriptions_dealer_key').on(t.dealerId)],
);
