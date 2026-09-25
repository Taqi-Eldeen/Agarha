import type { Role } from '@agarha/schemas';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, ilike, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { randomRef } from '../../common/crypto';
import { Errors } from '../../common/errors';
import { decodeCursor, encodeCursor, type Page } from '../../common/pagination';
import { DB, type Database } from '../../db/db';
import { branches, dealerMembers, dealers } from '../../db/schema/dealers';
import { EventBus } from '../../infra/events';
import { MapsService } from '../../infra/maps';
import { AuditService } from '../admin';
import { CatalogService } from '../catalog';
import { UsersService } from '../identity';
import { VerificationService } from '../verification';
import type { MembershipResolver } from '../identity';

type Business = {
  legalName: string;
  displayNameAr: string;
  displayNameEn: string;
  descriptionAr?: string | undefined;
  descriptionEn?: string | undefined;
  commercialRegistrationNo: string;
  taxCardNo: string;
  phone: string;
  whatsapp: string;
};
type BranchInput = {
  areaId: string;
  nameAr: string;
  nameEn: string;
  addressAr?: string | undefined;
  addressEn?: string | undefined;
  lat?: number | undefined;
  lng?: number | undefined;
  phone?: string | undefined;
  whatsapp?: string | undefined;
  isPrimary: boolean;
};

export interface Actor {
  userId: string;
  role: Role;
  ip?: string | undefined;
  requestId?: string | undefined;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'dealer';

const branchCols = {
  id: branches.id,
  dealerId: branches.dealerId,
  areaId: branches.areaId,
  nameAr: branches.nameAr,
  nameEn: branches.nameEn,
  addressAr: branches.addressAr,
  addressEn: branches.addressEn,
  phone: branches.phoneE164,
  whatsapp: branches.whatsappE164,
  isPrimary: branches.isPrimary,
  lat: sql<number | null>`ST_Y(${branches.location})`,
  lng: sql<number | null>`ST_X(${branches.location})`,
};

@Injectable()
export class DealersService implements MembershipResolver {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly events: EventBus,
    private readonly catalog: CatalogService,
    private readonly maps: MapsService,
    private readonly users: UsersService,
    private readonly verification: VerificationService,
  ) {}

  // ---- MembershipResolver (used by identity to build dealer sessions) ----
  async memberships(userId: string) {
    const rows = await this.db
      .select({ dealerId: dealerMembers.dealerId, role: dealerMembers.role, status: dealers.status })
      .from(dealerMembers)
      .innerJoin(dealers, eq(dealers.id, dealerMembers.dealerId))
      .where(eq(dealerMembers.userId, userId))
      .orderBy(sql`${dealerMembers.role} = 'dealer_owner' DESC`, asc(dealerMembers.createdAt));
    return rows.map((r) => ({ dealerId: r.dealerId, role: r.role, dealerActive: r.status !== 'suspended' }));
  }

  // ---- onboarding -------------------------------------------------------
  async createBusiness(userId: string, b: Business, actor: Actor) {
    if ((await this.memberships(userId)).length) throw Errors.conflict('You already belong to a dealer');
    return this.db.transaction(async (tx) => {
      const [d] = await tx
        .insert(dealers)
        .values({
          slug: `${slugify(b.displayNameEn)}-${randomRef(4).toLowerCase()}`,
          legalName: b.legalName,
          displayNameAr: b.displayNameAr,
          displayNameEn: b.displayNameEn,
          descriptionAr: b.descriptionAr ?? null,
          descriptionEn: b.descriptionEn ?? null,
          commercialRegistrationNo: b.commercialRegistrationNo,
          taxCardNo: b.taxCardNo,
          phoneE164: b.phone,
          whatsappE164: b.whatsapp,
        })
        .returning();
      await tx.insert(dealerMembers).values({ dealerId: d!.id, userId, role: 'dealer_owner' });
      await this.audit.record({ actorUserId: userId, actorRole: 'dealer_owner', action: 'dealer.create', targetType: 'dealer', targetId: d!.id, dealerId: d!.id, ...(actor.ip ? { ip: actor.ip } : {}), ...(actor.requestId ? { requestId: actor.requestId } : {}) }, tx);
      return d!;
    });
  }

  async get(dealerId: string) {
    const [d] = await this.db.select().from(dealers).where(eq(dealers.id, dealerId));
    if (!d) throw Errors.notFound('Dealer');
    return d;
  }

  async bySlug(slug: string) {
    const [d] = await this.db.select().from(dealers).where(eq(dealers.slug, slug));
    return d ?? null;
  }

  /** Public = verified and not suspended. The only check other modules should use. */
  isPublic(d: { status: string; suspendedAt: Date | null }) {
    return d.status === 'verified' && !d.suspendedAt;
  }

  async onboardingState(dealerId: string) {
    const d = await this.get(dealerId);
    const bs = await this.branches(dealerId);
    const docs = await this.verification.checklist(dealerId);
    return {
      dealer: d,
      branches: bs,
      documents: docs,
      steps: {
        business: true,
        branches: bs.length > 0,
        documents: docs.requiredUploaded,
        review: d.status === 'pending_review' || d.status === 'verified',
      },
      canSubmit: bs.length > 0 && docs.requiredUploaded && (d.status === 'onboarding' || d.status === 'rejected'),
    };
  }

  async updateProfile(dealerId: string, patch: Partial<Business>, actor: Actor) {
    const set: Partial<typeof dealers.$inferInsert> = {};
    if (patch.displayNameAr) set.displayNameAr = patch.displayNameAr;
    if (patch.displayNameEn) set.displayNameEn = patch.displayNameEn;
    if (patch.descriptionAr !== undefined) set.descriptionAr = patch.descriptionAr;
    if (patch.descriptionEn !== undefined) set.descriptionEn = patch.descriptionEn;
    if (patch.phone) set.phoneE164 = patch.phone;
    if (patch.whatsapp) set.whatsappE164 = patch.whatsapp;
    if (Object.keys(set).length) await this.db.update(dealers).set(set).where(eq(dealers.id, dealerId));
    await this.audit.record({ actorUserId: actor.userId, actorRole: actor.role, action: 'dealer.profile.update', targetType: 'dealer', targetId: dealerId, dealerId, metadata: { fields: Object.keys(set) } });
    return this.get(dealerId);
  }

  async submitForReview(dealerId: string, actor: Actor) {
    const s = await this.onboardingState(dealerId);
    if (!s.canSubmit) throw Errors.conflict('Add a branch and upload all required documents first', s.steps);
    await this.db.update(dealers).set({ status: 'pending_review' }).where(eq(dealers.id, dealerId));
    await this.audit.record({ actorUserId: actor.userId, actorRole: actor.role, action: 'dealer.submit', targetType: 'dealer', targetId: dealerId, dealerId });
    return this.onboardingState(dealerId);
  }

  // ---- branches ---------------------------------------------------------
  branches(dealerId: string) {
    return this.db.select(branchCols).from(branches).where(eq(branches.dealerId, dealerId)).orderBy(desc(branches.isPrimary), asc(branches.createdAt));
  }

  async branch(dealerId: string, branchId: string) {
    const [b] = await this.db.select(branchCols).from(branches).where(and(eq(branches.id, branchId), eq(branches.dealerId, dealerId)));
    if (!b) throw Errors.notFound('Branch');
    return b;
  }

  async branchesByIds(ids: string[]) {
    if (!ids.length) return [];
    return this.db.select(branchCols).from(branches).where(inArray(branches.id, ids));
  }

  private async location(b: BranchInput) {
    if (b.lat !== undefined && b.lng !== undefined) return { lat: b.lat, lng: b.lng };
    const area = await this.catalog.area(b.areaId);
    const address = [b.addressEn ?? b.addressAr, area?.nameEn, area?.cityNameEn, 'Egypt'].filter(Boolean).join(', ');
    const g = await this.maps.geocode(address, b.addressEn ? 'en' : 'ar');
    return g ? { lat: g.lat, lng: g.lng } : null;
  }

  async saveBranch(dealerId: string, b: BranchInput, actor: Actor, branchId?: string) {
    const area = await this.catalog.area(b.areaId);
    if (!area) throw Errors.badRequest('validation_failed', 'Unknown area');
    const loc = await this.location(b);
    const values = {
      dealerId,
      areaId: b.areaId,
      nameAr: b.nameAr,
      nameEn: b.nameEn,
      addressAr: b.addressAr ?? null,
      addressEn: b.addressEn ?? null,
      phoneE164: b.phone ?? null,
      whatsappE164: b.whatsapp ?? null,
      isPrimary: b.isPrimary,
      location: loc ? sql`ST_SetSRID(ST_MakePoint(${loc.lng}, ${loc.lat}), 4326)` : null,
    };
    const existing = await this.branches(dealerId);
    return this.db.transaction(async (tx) => {
      const makePrimary = b.isPrimary || existing.length === 0 || (existing.length === 1 && existing[0]!.id === branchId);
      if (makePrimary) await tx.update(branches).set({ isPrimary: false }).where(eq(branches.dealerId, dealerId));
      let id = branchId;
      if (branchId) {
        const r = await tx.update(branches).set({ ...values, isPrimary: makePrimary } as never).where(and(eq(branches.id, branchId), eq(branches.dealerId, dealerId))).returning({ id: branches.id });
        if (!r.length) throw Errors.notFound('Branch');
      } else {
        const [r] = await tx.insert(branches).values({ ...values, isPrimary: makePrimary } as never).returning({ id: branches.id });
        id = r!.id;
      }
      await this.audit.record({ actorUserId: actor.userId, actorRole: actor.role, action: branchId ? 'branch.update' : 'branch.create', targetType: 'branch', targetId: id ?? null, dealerId }, tx);
      return id!;
    }).then((id) => this.branch(dealerId, id));
  }

  async deleteBranch(dealerId: string, branchId: string, actor: Actor, hasListings: (branchId: string) => Promise<boolean>) {
    await this.branch(dealerId, branchId);
    if (await hasListings(branchId)) throw Errors.conflict('Move or archive the cars in this branch first');
    await this.db.delete(branches).where(and(eq(branches.id, branchId), eq(branches.dealerId, dealerId)));
    await this.audit.record({ actorUserId: actor.userId, actorRole: actor.role, action: 'branch.delete', targetType: 'branch', targetId: branchId, dealerId });
  }

  // ---- team (P5) --------------------------------------------------------
  async team(dealerId: string) {
    const ms = await this.db.select().from(dealerMembers).where(eq(dealerMembers.dealerId, dealerId)).orderBy(asc(dealerMembers.createdAt));
    const people = new Map((await this.users.basicByIds(ms.map((m) => m.userId))).map((u) => [u.id, u]));
    return ms.map((m) => ({ userId: m.userId, role: m.role, addedAt: m.createdAt, phone: people.get(m.userId)?.phone ?? null, displayName: people.get(m.userId)?.displayName ?? null, lastSignInAt: people.get(m.userId)?.lastSignInAt ?? null }));
  }

  async invite(dealerId: string, phone: string, role: 'dealer_owner' | 'dealer_staff', actor: Actor, maxMembers: number) {
    const current = await this.team(dealerId);
    if (current.length >= maxMembers) throw Errors.conflict('Your plan does not allow more team members', { maxMembers });
    const user = await this.users.findOrCreateByPhone(phone, 'ar');
    if (current.some((m) => m.userId === user.id)) throw Errors.conflict('Already a member');
    const others = await this.memberships(user.id);
    if (others.length) throw Errors.conflict('This number already belongs to another dealer');
    await this.db.insert(dealerMembers).values({ dealerId, userId: user.id, role });
    await this.audit.record({ actorUserId: actor.userId, actorRole: actor.role, action: 'team.invite', targetType: 'user', targetId: user.id, dealerId, metadata: { role } });
    return this.team(dealerId);
  }

  async removeMember(dealerId: string, userId: string, actor: Actor) {
    const team = await this.team(dealerId);
    const m = team.find((x) => x.userId === userId);
    if (!m) throw Errors.notFound('Member');
    if (m.role === 'dealer_owner' && team.filter((x) => x.role === 'dealer_owner').length === 1) throw Errors.conflict('A dealer needs at least one owner');
    await this.db.delete(dealerMembers).where(and(eq(dealerMembers.dealerId, dealerId), eq(dealerMembers.userId, userId)));
    await this.audit.record({ actorUserId: actor.userId, actorRole: actor.role, action: 'team.remove', targetType: 'user', targetId: userId, dealerId });
    return this.team(dealerId);
  }

  // ---- public directory -------------------------------------------------
  async directory(q: { city?: string | undefined; cursor?: string | undefined; limit: number }): Promise<Page<typeof dealers.$inferSelect & { branchCount: number }>> {
    const c = decodeCursor<{ n: string; id: string }>(q.cursor);
    const cityFilter = q.city
      ? sql`EXISTS (SELECT 1 FROM branches b JOIN areas a ON a.id = b.area_id JOIN cities ci ON ci.id = a.city_id WHERE b.dealer_id = "dealers"."id" AND ci.slug = ${q.city})`
      : undefined;
    const rows = await this.db
      .select({ d: dealers, branchCount: sql<number>`(SELECT count(*)::int FROM branches b WHERE b.dealer_id = "dealers"."id")` })
      .from(dealers)
      .where(and(eq(dealers.status, 'verified'), isNull(dealers.suspendedAt), cityFilter, c ? or(sql`${dealers.displayNameEn} > ${c.n}`, and(eq(dealers.displayNameEn, c.n), sql`${dealers.id} > ${c.id}`)) : undefined))
      .orderBy(asc(dealers.displayNameEn), asc(dealers.id))
      .limit(q.limit + 1);
    const items = rows.slice(0, q.limit).map((r) => ({ ...r.d, branchCount: r.branchCount }));
    const last = items.at(-1);
    return { items, nextCursor: rows.length > q.limit && last ? encodeCursor({ n: last.displayNameEn, id: last.id }) : null };
  }

  // ---- admin ------------------------------------------------------------
  async adminList(q: { status?: string | undefined; q?: string | undefined; cursor?: string | undefined; limit: number }) {
    const c = decodeCursor<{ t: string; id: string }>(q.cursor);
    const statusFilter =
      q.status === 'suspended' ? sql`${dealers.suspendedAt} IS NOT NULL` : q.status ? and(eq(dealers.status, q.status as never), isNull(dealers.suspendedAt)) : undefined;
    const rows = await this.db
      .select()
      .from(dealers)
      .where(and(statusFilter, q.q ? or(ilike(dealers.displayNameEn, `%${q.q}%`), ilike(dealers.displayNameAr, `%${q.q}%`), ilike(dealers.legalName, `%${q.q}%`), eq(dealers.phoneE164, q.q)) : undefined, c ? or(lt(dealers.updatedAt, new Date(c.t)), and(eq(dealers.updatedAt, new Date(c.t)), lt(dealers.id, c.id))) : undefined))
      .orderBy(q.status === 'pending_review' ? asc(dealers.updatedAt) : desc(dealers.updatedAt), desc(dealers.id))
      .limit(q.limit + 1);
    const items = rows.slice(0, q.limit);
    const last = items.at(-1);
    return { items, nextCursor: rows.length > q.limit && last ? encodeCursor({ t: last.updatedAt.toISOString(), id: last.id }) : null };
  }

  async verify(dealerId: string, actor: Actor) {
    const d = await this.get(dealerId);
    if (d.status !== 'pending_review') throw Errors.conflict('Dealer is not waiting for review');
    if (!(await this.verification.allRequiredApproved(dealerId))) throw Errors.conflict('Approve every required document first');
    await this.db.update(dealers).set({ status: 'verified', verifiedAt: new Date(), verifiedBy: actor.userId }).where(eq(dealers.id, dealerId));
    await this.audit.record({ actorUserId: actor.userId, actorRole: actor.role, action: 'dealer.verify', targetType: 'dealer', targetId: dealerId, dealerId, ...(actor.ip ? { ip: actor.ip } : {}) });
    await this.events.publish('dealer.verified', { dealerId });
    return this.get(dealerId);
  }

  async reject(dealerId: string, reason: string, actor: Actor) {
    const d = await this.get(dealerId);
    if (d.status !== 'pending_review') throw Errors.conflict('Dealer is not waiting for review');
    await this.db.update(dealers).set({ status: 'rejected' }).where(eq(dealers.id, dealerId));
    await this.audit.record({ actorUserId: actor.userId, actorRole: actor.role, action: 'dealer.reject', targetType: 'dealer', targetId: dealerId, dealerId, metadata: { reason } });
    await this.events.publish('dealer.rejected', { dealerId, reason });
    return this.get(dealerId);
  }

  /** Kill switch (risk #2): hides every listing immediately; public queries also check suspendedAt. */
  async suspend(dealerId: string, reason: string, actor: Actor) {
    await this.get(dealerId);
    await this.db.update(dealers).set({ suspendedAt: new Date(), suspendedReason: reason }).where(eq(dealers.id, dealerId));
    await this.audit.record({ actorUserId: actor.userId, actorRole: actor.role, action: 'dealer.suspend', targetType: 'dealer', targetId: dealerId, dealerId, metadata: { reason } });
    await this.events.publish('dealer.suspended', { dealerId, reason });
    return this.get(dealerId);
  }

  async unsuspend(dealerId: string, actor: Actor) {
    await this.db.update(dealers).set({ suspendedAt: null, suspendedReason: null }).where(eq(dealers.id, dealerId));
    await this.audit.record({ actorUserId: actor.userId, actorRole: actor.role, action: 'dealer.unsuspend', targetType: 'dealer', targetId: dealerId, dealerId });
    await this.events.publish('dealer.unsuspended', { dealerId });
    return this.get(dealerId);
  }

  /** Dealers whose members should get notifications (owner WhatsApp number + member user ids). */
  async contacts(dealerId: string) {
    const d = await this.get(dealerId);
    const ms = await this.db.select({ userId: dealerMembers.userId }).from(dealerMembers).where(eq(dealerMembers.dealerId, dealerId));
    return { whatsapp: d.whatsappE164, phone: d.phoneE164, memberIds: ms.map((m) => m.userId), nameAr: d.displayNameAr, nameEn: d.displayNameEn };
  }

  async allPublicIds() {
    return this.db.select({ id: dealers.id, slug: dealers.slug, updatedAt: dealers.updatedAt }).from(dealers).where(and(eq(dealers.status, 'verified'), isNull(dealers.suspendedAt)));
  }
}
