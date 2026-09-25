import type { Locale, Role, SessionUser } from '@agarha/schemas';
import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { and, eq, inArray } from 'drizzle-orm';
import type { SessionScope } from '../../common/auth/auth-context';
import { DB, type Database } from '../../db/db';
import { userCredentials, userIdentities, userRoles, users } from '../../db/schema/identity';
import { MEMBERSHIP_RESOLVER, type MembershipResolver } from './ports';

const PLATFORM_STAFF: Role[] = ['moderator', 'support', 'admin'];

export interface Claims {
  userId: string;
  scope: SessionScope;
  roles: Role[];
  dealerId?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly moduleRef: ModuleRef,
  ) {}

  /** Resolved lazily: the dealers module provides it and itself depends on UsersService. */
  private get memberships(): MembershipResolver {
    return this.moduleRef.get<MembershipResolver>(MEMBERSHIP_RESOLVER, { strict: false });
  }

  async findByPhone(phone: string) {
    const [u] = await this.db.select().from(users).where(eq(users.phoneE164, phone));
    return u ?? null;
  }

  async findById(id: string) {
    const [u] = await this.db.select().from(users).where(eq(users.id, id));
    return u ?? null;
  }

  async findOrCreateByPhone(phone: string, locale: Locale) {
    const existing = await this.findByPhone(phone);
    if (existing) return existing;
    const [created] = await this.db
      .insert(users)
      .values({ phoneE164: phone, locale })
      .onConflictDoNothing({ target: users.phoneE164 })
      .returning();
    return created ?? (await this.findByPhone(phone))!;
  }

  async setDisplayName(userId: string, displayName: string) {
    await this.db.update(users).set({ displayName }).where(eq(users.id, userId));
  }

  /** Minimal profile for other modules (team page, admin). Never exposes credentials. */
  async basicByIds(ids: string[]) {
    if (!ids.length) return [];
    return this.db
      .select({
        id: users.id,
        phone: users.phoneE164,
        displayName: users.displayName,
        status: users.status,
        lastSignInAt: users.lastSignInAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(inArray(users.id, ids));
  }

  async setStatus(userId: string, status: 'active' | 'blocked') {
    await this.db.update(users).set({ status }).where(eq(users.id, userId));
  }

  async touchSignIn(userId: string) {
    await this.db.update(users).set({ lastSignInAt: new Date() }).where(eq(users.id, userId));
  }

  async platformRoles(userId: string): Promise<Role[]> {
    const rows = await this.db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, userId));
    return rows.map((r) => r.role);
  }

  /** Re-derives session claims from current data. Returns null if the session must end. */
  async claimsFor(
    userId: string,
    scope: SessionScope,
    dealerId: string | null = null,
  ): Promise<Claims | null> {
    const u = await this.findById(userId);
    if (!u || u.status !== 'active') return null;
    if (scope === 'customer') return { userId, scope, roles: ['customer'] };
    if (scope === 'admin') {
      const roles = (await this.platformRoles(userId)).filter((r) => PLATFORM_STAFF.includes(r));
      return roles.length ? { userId, scope, roles } : null;
    }
    const ms = await this.memberships.memberships(userId);
    if (!ms.length) return { userId, scope, roles: [] }; // signed up, onboarding not started
    const m = (dealerId && ms.find((x) => x.dealerId === dealerId)) || ms[0]!;
    return { userId, scope, roles: [m.role], dealerId: m.dealerId };
  }

  toSessionUser(
    u: { id: string; phoneE164: string | null; locale: Locale },
    roles: Role[],
  ): SessionUser {
    return { id: u.id, phone: u.phoneE164 ?? '', roles, locale: u.locale };
  }

  async credentials(userId: string) {
    const [c] = await this.db
      .select()
      .from(userCredentials)
      .where(eq(userCredentials.userId, userId));
    return c ?? null;
  }

  async upsertCredentials(userId: string, values: Partial<typeof userCredentials.$inferInsert>) {
    await this.db
      .insert(userCredentials)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: userCredentials.userId, set: values });
  }

  async findIdentity(provider: 'google' | 'apple' | 'google_workspace', subject: string) {
    const [i] = await this.db
      .select()
      .from(userIdentities)
      .where(and(eq(userIdentities.provider, provider), eq(userIdentities.subject, subject)));
    return i ?? null;
  }

  async linkIdentity(
    userId: string,
    provider: 'google' | 'apple' | 'google_workspace',
    subject: string,
    email?: string,
  ) {
    await this.db
      .insert(userIdentities)
      .values({ userId, provider, subject, email: email ?? null })
      .onConflictDoNothing();
  }

  async grantRoles(userId: string, roles: Role[]) {
    if (!roles.length) return;
    await this.db
      .insert(userRoles)
      .values(roles.map((role) => ({ userId, role })))
      .onConflictDoNothing();
  }

  async revokeRoles(userId: string, roles: Role[]) {
    await this.db
      .delete(userRoles)
      .where(and(eq(userRoles.userId, userId), inArray(userRoles.role, roles)));
  }
}
