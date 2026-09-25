import type { Role } from '@agarha/schemas';
import { Inject, Injectable } from '@nestjs/common';
import { hmac } from '../../common/crypto';
import { ENV, type Env } from '../../config/env';
import { DB, type Database, type Tx } from '../../db/db';
import { auditLog } from '../../db/schema/admin';

export interface AuditEntry {
  actorUserId: string | null;
  actorRole: Role | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  dealerId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string;
  requestId?: string;
}

/** Append-only audit trail for admin and dealer-owner actions (and every private document view). */
@Injectable()
export class AuditService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async record(e: AuditEntry, tx?: Tx): Promise<void> {
    await (tx ?? this.db).insert(auditLog).values({
      actorUserId: e.actorUserId,
      actorRole: e.actorRole,
      action: e.action,
      targetType: e.targetType,
      targetId: e.targetId ?? null,
      dealerId: e.dealerId ?? null,
      metadata: e.metadata ?? null,
      ipHash: e.ip ? hmac(this.env.HASH_PEPPER, `ip:${e.ip}`) : null,
      requestId: e.requestId ?? null,
    });
  }
}
