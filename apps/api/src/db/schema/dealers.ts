// Owned by the dealers module.
import { sql } from 'drizzle-orm';
import { boolean, geometry, index, pgTable, primaryKey, text, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, tstz, updatedAt } from './_columns';
import { areas } from './catalog';
import { dealerMemberRoleEnum, dealerStatusEnum } from './enums';
import { users } from './identity';

export const dealers = pgTable(
  'dealers',
  {
    id: id(),
    slug: text('slug').notNull(),
    legalName: text('legal_name').notNull(),
    displayNameAr: text('display_name_ar').notNull(),
    displayNameEn: text('display_name_en').notNull(),
    descriptionAr: text('description_ar'),
    descriptionEn: text('description_en'),
    /** Business registration numbers (not personal IDs). */
    commercialRegistrationNo: text('commercial_registration_no'),
    taxCardNo: text('tax_card_no'),
    status: dealerStatusEnum('status').notNull().default('onboarding'),
    phoneE164: text('phone_e164').notNull(),
    whatsappE164: text('whatsapp_e164').notNull(),
    verifiedAt: tstz('verified_at'),
    verifiedBy: uuid('verified_by').references(() => users.id),
    /** Admin kill switch: hides every listing immediately. */
    suspendedAt: tstz('suspended_at'),
    suspendedReason: text('suspended_reason'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('dealers_slug_key').on(t.slug), index('dealers_status_idx').on(t.status)],
);

export const branches = pgTable(
  'branches',
  {
    id: id(),
    dealerId: uuid('dealer_id').notNull().references(() => dealers.id, { onDelete: 'cascade' }),
    areaId: uuid('area_id').notNull().references(() => areas.id),
    nameAr: text('name_ar').notNull(),
    nameEn: text('name_en').notNull(),
    addressAr: text('address_ar'),
    addressEn: text('address_en'),
    location: geometry('location', { type: 'point', mode: 'xy', srid: 4326 }),
    phoneE164: text('phone_e164'),
    whatsappE164: text('whatsapp_e164'),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('branches_dealer_idx').on(t.dealerId),
    index('branches_area_idx').on(t.areaId),
    index('branches_location_gist').using('gist', t.location),
    // Lets listings carry dealer_id with a composite FK so it can never disagree with the branch.
    unique('branches_id_dealer_key').on(t.id, t.dealerId),
    uniqueIndex('branches_one_primary_per_dealer').on(t.dealerId).where(sql`${t.isPrimary}`),
  ],
);

export const dealerMembers = pgTable(
  'dealer_members',
  {
    dealerId: uuid('dealer_id').notNull().references(() => dealers.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: dealerMemberRoleEnum('role').notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.dealerId, t.userId] }), index('dealer_members_user_idx').on(t.userId)],
);
