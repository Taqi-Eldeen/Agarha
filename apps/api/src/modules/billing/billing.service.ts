import type { Role } from '@agarha/schemas';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, desc, eq, gt, lt, sql } from 'drizzle-orm';
import { Errors } from '../../common/errors';
import { ENV, type Env } from '../../config/env';
import { DB, type Database } from '../../db/db';
import { featuredPlacements, invoices, paymentEvents, plans, subscriptions } from '../../db/schema/billing';
import { EventBus } from '../../infra/events';
import { AuditService } from '../admin';
import { PAYMENT_GATEWAY, type PaymentGateway } from './gateway';

export const VAT_RATE = 0.14;
export const FREE_PLAN = 'free';
const PERIOD_DAYS = 30;
const GRACE_DAYS = 7;

export interface Limits {
  planCode: string;
  maxLiveListings: number | null;
  maxTeamMembers: number;
  featuredCreditsRemaining: number;
}

/** VAT-inclusive whole-EGP amount -> the included VAT portion. */
export const includedVat = (totalEgp: number) => Math.round(totalEgp - totalEgp / (1 + VAT_RATE));

@Injectable()
export class BillingService {
  private readonly logger = new Logger('Billing');
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    @Inject(PAYMENT_GATEWAY) readonly gateway: PaymentGateway,
    private readonly events: EventBus,
    private readonly audit: AuditService,
  ) {}

  listPlans(includeInactive = false) {
    return this.db.select().from(plans).where(includeInactive ? undefined : eq(plans.isActive, true)).orderBy(asc(plans.sortOrder));
  }

  async plan(code: string) {
    const [p] = await this.db.select().from(plans).where(eq(plans.code, code));
    if (!p) throw Errors.notFound('Plan');
    return p;
  }

  async subscription(dealerId: string) {
    const [s] = await this.db.select().from(subscriptions).where(eq(subscriptions.dealerId, dealerId));
    return s ?? null;
  }

  /** Q1: free at launch. No subscription = free plan limits. */
  async limits(dealerId: string): Promise<Limits> {
    const s = await this.subscription(dealerId);
    const code = s && (s.status === 'active' || s.status === 'trialing' || s.status === 'past_due') ? s.planCode : FREE_PLAN;
    const [p] = await this.db.select().from(plans).where(eq(plans.code, code));
    return { planCode: code, maxLiveListings: p?.maxLiveListings ?? null, maxTeamMembers: p?.maxTeamMembers ?? 3, featuredCreditsRemaining: s?.featuredCreditsRemaining ?? 0 };
  }

  async overview(dealerId: string) {
    const invs = await this.db.select().from(invoices).where(eq(invoices.dealerId, dealerId)).orderBy(desc(invoices.createdAt)).limit(24);
    const featured = await this.db.select().from(featuredPlacements).where(and(eq(featuredPlacements.dealerId, dealerId), gt(featuredPlacements.endsAt, new Date()))).orderBy(asc(featuredPlacements.endsAt));
    return { subscription: await this.subscription(dealerId), limits: await this.limits(dealerId), invoices: invs, activeFeatured: featured, featuredPricePerDayEgp: this.env.FEATURED_PRICE_PER_DAY_EGP };
  }

  private async nextInvoiceNumber(): Promise<string> {
    const r = await this.db.execute<{ n: string }>(sql`SELECT nextval('invoice_number_seq')::text AS n`);
    return `AG-${new Date().getFullYear()}-${String(r.rows[0]!.n).padStart(6, '0')}`;
  }

  private async openInvoice(dealerId: string, lines: { kind: 'subscription' | 'featured'; description: string; amountEgp: number; ref?: string }[]) {
    const total = lines.reduce((s, l) => s + l.amountEgp, 0);
    const [inv] = await this.db.insert(invoices).values({ number: await this.nextInvoiceNumber(), dealerId, status: 'open', totalEgp: total, vatEgp: includedVat(total), lines, gateway: this.gateway.name }).returning();
    return inv!;
  }

  private async checkout(inv: typeof invoices.$inferSelect, contact: { name: string; phone: string }, locale: 'ar' | 'en') {
    const c = await this.gateway.createCheckout({
      invoiceId: inv.id,
      invoiceNumber: inv.number,
      totalEgp: inv.totalEgp,
      description: inv.lines.map((l) => l.description).join(', '),
      customer: contact,
      returnUrl: `${this.env.PUBLIC_WEB_URL}/${locale}/dealer/billing?invoice=${inv.id}`,
      webhookUrl: `${this.env.API_PUBLIC_URL}/v1/webhooks/payments/${this.gateway.name}`,
    });
    await this.db.update(invoices).set({ gatewayRef: c.gatewayRef }).where(eq(invoices.id, inv.id));
    return { invoice: { ...inv, gatewayRef: c.gatewayRef }, checkoutUrl: c.url };
  }

  async subscribe(dealerId: string, planCode: string, contact: { name: string; phone: string }, actor: { userId: string; role: Role }, locale: 'ar' | 'en') {
    const p = await this.plan(planCode);
    if (!p.isActive) throw Errors.conflict('Plan is not available');
    if (p.priceMonthlyEgp === 0) {
      await this.activate(dealerId, p.code);
      await this.audit.record({ actorUserId: actor.userId, actorRole: actor.role, action: 'billing.subscribe', targetType: 'plan', targetId: p.code, dealerId });
      return { invoice: null, checkoutUrl: null, subscription: await this.subscription(dealerId) };
    }
    const inv = await this.openInvoice(dealerId, [{ kind: 'subscription', description: `${p.nameEn} (${PERIOD_DAYS} days)`, amountEgp: p.priceMonthlyEgp, ref: p.code }]);
    await this.audit.record({ actorUserId: actor.userId, actorRole: actor.role, action: 'billing.checkout', targetType: 'invoice', targetId: inv.id, dealerId, metadata: { plan: p.code } });
    return { ...(await this.checkout(inv, contact, locale)), subscription: await this.subscription(dealerId) };
  }

  async cancel(dealerId: string, actor: { userId: string; role: Role }) {
    await this.db.update(subscriptions).set({ cancelAtPeriodEnd: true }).where(eq(subscriptions.dealerId, dealerId));
    await this.audit.record({ actorUserId: actor.userId, actorRole: actor.role, action: 'billing.cancel', targetType: 'subscription', targetId: dealerId, dealerId });
    return this.subscription(dealerId);
  }

  /** Feature a listing: uses a monthly credit when available, otherwise creates an invoice. */
  async feature(dealerId: string, listingId: string, days: number, contact: { name: string; phone: string }, actor: { userId: string; role: Role }, locale: 'ar' | 'en') {
    const limits = await this.limits(dealerId);
    if (limits.featuredCreditsRemaining > 0 && days <= 7) {
      await this.db.update(subscriptions).set({ featuredCreditsRemaining: sql`${subscriptions.featuredCreditsRemaining} - 1` }).where(eq(subscriptions.dealerId, dealerId));
      const placement = await this.placeFeatured(dealerId, listingId, days, null);
      await this.audit.record({ actorUserId: actor.userId, actorRole: actor.role, action: 'billing.feature.credit', targetType: 'listing', targetId: listingId, dealerId, metadata: { days } });
      return { placement, invoice: null, checkoutUrl: null };
    }
    const inv = await this.openInvoice(dealerId, [{ kind: 'featured', description: `Featured listing (${days} days)`, amountEgp: days * this.env.FEATURED_PRICE_PER_DAY_EGP, ref: `${listingId}:${days}` }]);
    await this.audit.record({ actorUserId: actor.userId, actorRole: actor.role, action: 'billing.feature.checkout', targetType: 'invoice', targetId: inv.id, dealerId });
    return { placement: null, ...(await this.checkout(inv, contact, locale)) };
  }

  private async placeFeatured(dealerId: string, listingId: string, days: number, invoiceId: string | null) {
    // Extend from the end of any current placement.
    const [current] = await this.db.select().from(featuredPlacements).where(and(eq(featuredPlacements.listingId, listingId), gt(featuredPlacements.endsAt, new Date()))).orderBy(desc(featuredPlacements.endsAt)).limit(1);
    const startsAt = current ? current.endsAt : new Date();
    const endsAt = new Date(startsAt.getTime() + days * 86_400_000);
    const [p] = await this.db.insert(featuredPlacements).values({ listingId, dealerId, startsAt, endsAt, invoiceId }).returning();
    await this.events.publish('featured.activated', { listingId, dealerId, endsAt: endsAt.toISOString() });
    return p!;
  }

  private async activate(dealerId: string, planCode: string) {
    const p = await this.plan(planCode);
    const periodEnd = new Date(Date.now() + PERIOD_DAYS * 86_400_000);
    await this.db
      .insert(subscriptions)
      .values({ dealerId, planCode, status: 'active', currentPeriodEnd: periodEnd, featuredCreditsRemaining: p.featuredCreditsPerMonth, gateway: this.gateway.name })
      .onConflictDoUpdate({ target: subscriptions.dealerId, set: { planCode, status: 'active', currentPeriodEnd: periodEnd, featuredCreditsRemaining: p.featuredCreditsPerMonth, cancelAtPeriodEnd: false } });
    await this.events.publish('subscription.changed', { dealerId, planCode, status: 'active' });
  }

  /** Signature-verified webhook. Replays are no-ops (payment_events unique on gateway+event id). */
  async handleWebhook(gatewayName: string, query: Record<string, string>, headers: Record<string, string | undefined>, rawBody: string) {
    if (gatewayName !== this.gateway.name) throw Errors.notFound('Gateway');
    const ev = this.gateway.parseWebhook(query, headers, rawBody);
    if (!ev) throw Errors.unauthorized('Bad webhook signature');
    const inserted = await this.db.insert(paymentEvents).values({ gateway: gatewayName, eventId: ev.eventId, payload: ev.raw as object }).onConflictDoNothing().returning({ id: paymentEvents.id });
    if (!inserted.length) return { duplicate: true };

    const [inv] = await this.db.select().from(invoices).where(eq(invoices.id, ev.invoiceId));
    if (!inv) throw Errors.notFound('Invoice');
    if (!ev.success) {
      await this.db.update(invoices).set({ status: 'failed' }).where(eq(invoices.id, inv.id));
      return { status: 'failed' };
    }
    if (inv.status === 'paid') return { status: 'paid' };
    if (ev.amountEgp !== inv.totalEgp) {
      this.logger.error({ invoice: inv.id, expected: inv.totalEgp, got: ev.amountEgp }, 'payment amount mismatch');
      throw Errors.conflict('Amount mismatch');
    }
    await this.db.update(invoices).set({ status: 'paid', paidAt: new Date() }).where(eq(invoices.id, inv.id));
    for (const line of inv.lines) {
      if (line.kind === 'subscription' && line.ref) await this.activate(inv.dealerId, line.ref);
      if (line.kind === 'featured' && line.ref) {
        const [listingId, days] = line.ref.split(':');
        await this.placeFeatured(inv.dealerId, listingId!, Number(days), inv.id);
      }
    }
    await this.events.publish('invoice.paid', { invoiceId: inv.id, dealerId: inv.dealerId, totalEgp: inv.totalEgp, number: inv.number });
    return { status: 'paid' };
  }

  async invoice(dealerId: string, id: string) {
    const [inv] = await this.db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.dealerId, dealerId)));
    if (!inv) throw Errors.notFound('Invoice');
    return inv;
  }

  /** Daily: open renewal invoices 3 days before period end; past-due after end; downgrade after grace. */
  async runRenewals(now = new Date()) {
    const soon = new Date(now.getTime() + 3 * 86_400_000);
    const due = await this.db.select().from(subscriptions).where(and(eq(subscriptions.status, 'active'), lt(subscriptions.currentPeriodEnd, soon), sql`${subscriptions.planCode} <> ${FREE_PLAN}`));
    let opened = 0;
    for (const s of due) {
      if (s.cancelAtPeriodEnd) {
        if (s.currentPeriodEnd && s.currentPeriodEnd < now) await this.activate(s.dealerId, FREE_PLAN);
        continue;
      }
      const [existing] = await this.db.select({ id: invoices.id }).from(invoices).where(and(eq(invoices.dealerId, s.dealerId), eq(invoices.status, 'open'), gt(invoices.createdAt, new Date(now.getTime() - 5 * 86_400_000))));
      if (!existing) {
        const p = await this.plan(s.planCode);
        await this.openInvoice(s.dealerId, [{ kind: 'subscription', description: `${p.nameEn} renewal`, amountEgp: p.priceMonthlyEgp, ref: p.code }]);
        opened++;
      }
      if (s.currentPeriodEnd && s.currentPeriodEnd < now) await this.db.update(subscriptions).set({ status: 'past_due' }).where(eq(subscriptions.id, s.id));
    }
    const lapsed = await this.db.select().from(subscriptions).where(and(eq(subscriptions.status, 'past_due'), lt(subscriptions.currentPeriodEnd, new Date(now.getTime() - GRACE_DAYS * 86_400_000))));
    for (const s of lapsed) await this.activate(s.dealerId, FREE_PLAN);
    return { opened, downgraded: lapsed.length };
  }

  /** Listing ids currently featured (for search ranking / badges). */
  async featuredListingIds(): Promise<Set<string>> {
    const rows = await this.db.select({ id: featuredPlacements.listingId }).from(featuredPlacements).where(and(lt(featuredPlacements.startsAt, new Date()), gt(featuredPlacements.endsAt, new Date())));
    return new Set(rows.map((r) => r.id));
  }

  // ---- admin ----
  async upsertPlan(p: typeof plans.$inferInsert) {
    await this.db.insert(plans).values(p).onConflictDoUpdate({ target: plans.code, set: p });
    return this.plan(p.code);
  }
  adminInvoices(status?: string) {
    return this.db.select().from(invoices).where(status ? eq(invoices.status, status as never) : undefined).orderBy(desc(invoices.createdAt)).limit(200);
  }
}
