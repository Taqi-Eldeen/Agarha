// In-process domain events. Modules publish facts ("lead.created"); other modules subscribe
// through this bus instead of reading each other's tables. Every event is also put on the
// `events` queue so the worker can do slow follow-up work (notifications, analytics).
import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { Queues } from './queue/queues';

export interface DomainEvents {
  'lead.created': {
    leadId: string;
    listingId: string;
    dealerId: string;
    userId: string | null;
    channel: 'whatsapp' | 'call';
    refCode: string;
    locale: 'ar' | 'en';
  };
  'listing.published': { listingId: string; dealerId: string };
  /** Any change that affects what the public sees (facts, price, photos, availability, status). */
  'listing.changed': { listingId: string };
  'listing.hidden': { listingId: string; dealerId: string; reason: string };
  'dealer.verified': { dealerId: string };
  'dealer.rejected': { dealerId: string; reason: string };
  'dealer.suspended': { dealerId: string; reason: string };
  'dealer.unsuspended': { dealerId: string };
  'review.published': { reviewId: string; dealerId: string };
  'availability_request.created': { requestId: string; dealerId: string; listingId: string };
  'availability_request.answered': { requestId: string; userId: string; available: boolean };
  'user.deleted': { userId: string };
  'featured.activated': { listingId: string; dealerId: string; endsAt: string };
  'subscription.changed': { dealerId: string; planCode: string; status: string };
  'invoice.paid': { invoiceId: string; dealerId: string; totalEgp: number; number: string };
}
export type EventName = keyof DomainEvents;
type Handler<E extends EventName> = (payload: DomainEvents[E]) => Promise<void> | void;

@Injectable()
export class EventBus {
  private readonly logger = new Logger('EventBus');
  private readonly handlers = new Map<EventName, Handler<EventName>[]>();

  constructor(private readonly queues: Queues) {}

  on<E extends EventName>(name: E, handler: Handler<E>): void {
    const list = this.handlers.get(name) ?? [];
    list.push(handler as Handler<EventName>);
    this.handlers.set(name, list);
  }

  async publish<E extends EventName>(name: E, payload: DomainEvents[E]): Promise<void> {
    for (const h of this.handlers.get(name) ?? []) {
      try {
        await h(payload);
      } catch (err) {
        // A subscriber failure never fails the publisher's request.
        this.logger.error({ err, event: name }, 'event handler failed');
      }
    }
    await this.queues.add('events', {
      name,
      payload: payload as Record<string, unknown>,
      occurredAt: new Date().toISOString(),
    });
  }
}

@Global()
@Module({ providers: [EventBus], exports: [EventBus] })
export class EventsModule {}
