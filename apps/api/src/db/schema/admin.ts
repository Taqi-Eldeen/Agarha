// Owned by the admin module. Append-only: covers every admin and dealer-owner action,
// and every view of a verification document.
import { bigserial, index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt } from './_columns';
import { roleEnum } from './enums';
import { users } from './identity';

export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    actorRole: roleEnum('actor_role'),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id'),
    dealerId: uuid('dealer_id'),
    metadata: jsonb('metadata'),
    ipHash: text('ip_hash'),
    requestId: text('request_id'),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_log_target_idx').on(t.targetType, t.targetId),
    index('audit_log_actor_idx').on(t.actorUserId, t.createdAt),
    index('audit_log_dealer_idx').on(t.dealerId, t.createdAt),
  ],
);
