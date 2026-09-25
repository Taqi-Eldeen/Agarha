import type { Locale } from '@agarha/schemas';
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { TokenService } from '../../common/auth/token.service';
import { DB, type Database } from '../../db/db';
import { userCredentials, userIdentities, users } from '../../db/schema/identity';
import { EventBus } from '../../infra/events';
import { PrivacyRegistry } from '../../infra/privacy';

@Injectable()
export class AccountService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly tokens: TokenService,
    private readonly privacy: PrivacyRegistry,
    private readonly events: EventBus,
  ) {}

  async update(userId: string, patch: { displayName?: string | null; locale?: Locale }) {
    const set: Partial<typeof users.$inferInsert> = {};
    if (patch.displayName !== undefined) set.displayName = patch.displayName;
    if (patch.locale) set.locale = patch.locale;
    if (Object.keys(set).length) await this.db.update(users).set(set).where(eq(users.id, userId));
  }

  async export(userId: string) {
    const [u] = await this.db.select().from(users).where(eq(users.id, userId));
    const identities = await this.db
      .select({ provider: userIdentities.provider, email: userIdentities.email, createdAt: userIdentities.createdAt })
      .from(userIdentities)
      .where(eq(userIdentities.userId, userId));
    const sections: Record<string, unknown> = {};
    for (const c of this.privacy.list()) sections[c.name] = await c.export(userId);
    return {
      generatedAt: new Date().toISOString(),
      account: u && { id: u.id, phone: u.phoneE164, displayName: u.displayName, locale: u.locale, createdAt: u.createdAt, lastSignInAt: u.lastSignInAt },
      linkedSignIns: identities,
      ...sections,
    };
  }

  /**
   * Immediate anonymisation: the user row stays (leads/reviews keep referential integrity),
   * but phone and name are removed, sessions revoked, and each module erases its own data.
   */
  async delete(userId: string) {
    await this.tokens.revokeAllForUser(userId, 'account_deleted');
    for (const c of this.privacy.list()) await c.erase(userId);
    await this.db.delete(userIdentities).where(eq(userIdentities.userId, userId));
    await this.db.delete(userCredentials).where(eq(userCredentials.userId, userId));
    await this.db
      .update(users)
      .set({ phoneE164: null, displayName: null, status: 'deleted', deletionRequestedAt: new Date(), deletedAt: new Date() })
      .where(eq(users.id, userId));
    await this.events.publish('user.deleted', { userId });
  }
}
