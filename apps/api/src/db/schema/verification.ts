// Owned by the verification module. Files live in the private-docs bucket.
// National ID numbers are never stored as text: only the uploaded image, behind signed URLs.
import { bigint, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, tstz } from './_columns';
import { dealers } from './dealers';
import { verificationDocStatusEnum, verificationDocTypeEnum } from './enums';
import { users } from './identity';

export const verificationDocs = pgTable(
  'verification_docs',
  {
    id: id(),
    dealerId: uuid('dealer_id').notNull().references(() => dealers.id, { onDelete: 'cascade' }),
    type: verificationDocTypeEnum('type').notNull(),
    status: verificationDocStatusEnum('status').notNull().default('uploaded'),
    storageKey: text('storage_key').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    sha256: text('sha256').notNull(),
    uploadedBy: uuid('uploaded_by').notNull().references(() => users.id),
    reviewedBy: uuid('reviewed_by').references(() => users.id),
    reviewedAt: tstz('reviewed_at'),
    rejectionReason: text('rejection_reason'),
    /** Rejected documents are purged 90 days after rejection. */
    deleteAfter: tstz('delete_after'),
    createdAt: createdAt(),
  },
  (t) => [index('verification_docs_dealer_idx').on(t.dealerId), index('verification_docs_status_idx').on(t.status)],
);
