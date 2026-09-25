import type { Role, VerificationDocType } from '@agarha/schemas';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, lt } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { Errors } from '../../common/errors';
import { DB, type Database } from '../../db/db';
import { verificationDocs } from '../../db/schema/verification';
import { Queues } from '../../infra/queue/queues';
import { STORAGE, type Storage } from '../../infra/storage/storage';
import { AuditService } from '../admin';
import { MAX_PHOTO_BYTES, RejectedMedia, sanitiseDocument } from '../media';

export const REQUIRED_DOC_TYPES: VerificationDocType[] = ['commercial_registration', 'tax_card', 'owner_national_id'];
export const SIGNED_URL_TTL_SECONDS = 300;
const REJECTED_RETENTION_DAYS = 90;

export interface DocActor {
  userId: string;
  role: Role;
  ip?: string | undefined;
  requestId?: string | undefined;
}

@Injectable()
export class VerificationService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(STORAGE) private readonly storage: Storage,
    private readonly queues: Queues,
    private readonly audit: AuditService,
  ) {}

  async list(dealerId: string) {
    return this.db
      .select({ id: verificationDocs.id, type: verificationDocs.type, status: verificationDocs.status, mimeType: verificationDocs.mimeType, sizeBytes: verificationDocs.sizeBytes, rejectionReason: verificationDocs.rejectionReason, createdAt: verificationDocs.createdAt, reviewedAt: verificationDocs.reviewedAt })
      .from(verificationDocs)
      .where(eq(verificationDocs.dealerId, dealerId))
      .orderBy(desc(verificationDocs.createdAt));
  }

  /** Latest document per type decides the checklist. */
  async checklist(dealerId: string) {
    const docs = await this.list(dealerId);
    const latest = new Map<string, (typeof docs)[number]>();
    for (const d of docs) if (!latest.has(d.type)) latest.set(d.type, d);
    const items = REQUIRED_DOC_TYPES.map((type) => ({ type, status: latest.get(type)?.status ?? 'missing', rejectionReason: latest.get(type)?.rejectionReason ?? null }));
    return { items, requiredUploaded: items.every((i) => i.status !== 'missing' && i.status !== 'rejected') };
  }

  async allRequiredApproved(dealerId: string) {
    const c = await this.checklist(dealerId);
    return c.items.every((i) => i.status === 'approved');
  }

  /** Step 1: presigned PUT into private-docs, type and size locked. */
  async createUpload(dealerId: string, input: { type: VerificationDocType; mimeType: 'application/pdf' | 'image/jpeg'; sizeBytes: number; sha256: string }, actor: DocActor) {
    if (input.sizeBytes > MAX_PHOTO_BYTES) throw Errors.badRequest('validation_failed', 'File is larger than 10 MB');
    const key = `dealers/${dealerId}/docs/${randomUUID()}.${input.mimeType === 'application/pdf' ? 'pdf' : 'jpg'}`;
    const [doc] = await this.db
      .insert(verificationDocs)
      .values({ dealerId, type: input.type, storageKey: key, mimeType: input.mimeType, sizeBytes: input.sizeBytes, sha256: input.sha256, uploadedBy: actor.userId, status: 'uploaded' })
      .returning({ id: verificationDocs.id });
    const upload = await this.storage.presignPut('private', key, input.mimeType, input.sizeBytes);
    await this.audit.record({ actorUserId: actor.userId, actorRole: actor.role, action: 'verification_doc.upload', targetType: 'verification_doc', targetId: doc!.id, dealerId, metadata: { type: input.type } });
    return { documentId: doc!.id, upload };
  }

  /** Step 2: client confirms the upload; the worker validates + sanitises it. */
  async complete(dealerId: string, docId: string) {
    const [d] = await this.db.select().from(verificationDocs).where(and(eq(verificationDocs.id, docId), eq(verificationDocs.dealerId, dealerId)));
    if (!d) throw Errors.notFound('Document');
    await this.queues.add('media', { kind: 'verification_doc', docId }, { jobId: `doc-${docId}` });
    return { id: d.id, status: d.status };
  }

  /** Worker: magic bytes + sanitise. A bad file is rejected automatically. */
  async process(docId: string) {
    const [d] = await this.db.select().from(verificationDocs).where(eq(verificationDocs.id, docId));
    if (!d) return;
    try {
      const raw = await this.storage.get('private', d.storageKey);
      const clean = await sanitiseDocument(raw);
      await this.storage.put('private', d.storageKey, clean.body, clean.type);
      await this.db.update(verificationDocs).set({ mimeType: clean.type, sizeBytes: clean.body.length }).where(eq(verificationDocs.id, docId));
    } catch (err) {
      const reason = err instanceof RejectedMedia ? err.message : 'file_missing';
      await this.db.update(verificationDocs).set({ status: 'rejected', rejectionReason: reason, deleteAfter: new Date(Date.now() + REJECTED_RETENTION_DAYS * 86_400_000) }).where(eq(verificationDocs.id, docId));
    }
  }

  /** Ops only: 5-minute signed URL, and every view is audit-logged. */
  async signedUrl(docId: string, actor: DocActor) {
    const [d] = await this.db.select().from(verificationDocs).where(eq(verificationDocs.id, docId));
    if (!d) throw Errors.notFound('Document');
    const url = await this.storage.presignGet('private', d.storageKey, SIGNED_URL_TTL_SECONDS);
    await this.audit.record({ actorUserId: actor.userId, actorRole: actor.role, action: 'verification_doc.view', targetType: 'verification_doc', targetId: docId, dealerId: d.dealerId, ...(actor.ip ? { ip: actor.ip } : {}), ...(actor.requestId ? { requestId: actor.requestId } : {}) });
    return { url, expiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(), mimeType: d.mimeType };
  }

  async review(docId: string, decision: { approve: true } | { approve: false; reason: string }, actor: DocActor) {
    const [d] = await this.db.select().from(verificationDocs).where(eq(verificationDocs.id, docId));
    if (!d) throw Errors.notFound('Document');
    await this.db
      .update(verificationDocs)
      .set(decision.approve
        ? { status: 'approved', reviewedBy: actor.userId, reviewedAt: new Date(), rejectionReason: null, deleteAfter: null }
        : { status: 'rejected', reviewedBy: actor.userId, reviewedAt: new Date(), rejectionReason: decision.reason, deleteAfter: new Date(Date.now() + REJECTED_RETENTION_DAYS * 86_400_000) })
      .where(eq(verificationDocs.id, docId));
    await this.audit.record({ actorUserId: actor.userId, actorRole: actor.role, action: decision.approve ? 'verification_doc.approve' : 'verification_doc.reject', targetType: 'verification_doc', targetId: docId, dealerId: d.dealerId, ...(decision.approve ? {} : { metadata: { reason: decision.reason } }) });
    return (await this.list(d.dealerId)).find((x) => x.id === docId);
  }

  /** Retention: rejected documents are deleted 90 days after rejection. */
  async purgeExpired(now = new Date()) {
    const expired = await this.db.select({ id: verificationDocs.id, key: verificationDocs.storageKey }).from(verificationDocs).where(and(eq(verificationDocs.status, 'rejected'), lt(verificationDocs.deleteAfter, now)));
    for (const d of expired) {
      await this.storage.delete('private', d.key).catch(() => undefined);
      await this.db.delete(verificationDocs).where(eq(verificationDocs.id, d.id));
    }
    return expired.length;
  }
}
