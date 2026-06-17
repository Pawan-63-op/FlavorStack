// Write port of the transactional outbox (Phase 6, Batch 6).
//
// Implements the application's `IOutboxStore` (`append(events, ctx)`). Every
// mutating identity use-case does, inside one Mongo transaction:
//
//   await unitOfWork.runInTransaction(async (ctx) => {
//     await userRepo.save/update(aggregate);   // session read from TransactionContext
//     await outboxStore.append(events, ctx);    // session passed explicitly as ctx
//   });
//
// so the aggregate write and the outbox rows land in the SAME transaction and
// commit (or roll back) atomically. The `ctx` handed to `append` IS the
// ClientSession produced by MongoUnitOfWork; we fall back to the shared
// TransactionContext (and finally to no session) so the store also works when
// invoked outside a transaction.
//
// Idempotency: the `outbox` collection has a unique index on `eventId`. Appends
// use `insertMany(..., { ordered: false })` and swallow duplicate-key errors, so
// re-appending an already-persisted event is a no-op rather than a failure
// (at-least-once friendly).
import type { ClientSession } from 'mongoose';
import { IOutboxStore } from '../../application/shared/outbox/IOutboxStore';
import { DomainEvent } from '../../domain/shared/DomainEvent';
import { TransactionContext } from './TransactionContext';
import {
  OutboxEventModel,
  OutboxEventDocument,
  OUTBOX_STATUS,
} from './models/OutboxEventModel';

// `DomainEvent` carries no `aggregateType`; we derive it from the event name so
// each row is tagged with the aggregate it belongs to. Unmapped events fall back
// to `'user'` — the Identity hierarchy persists to a single `users` collection and
// was the original (sole) producer. As more contexts emit to the shared outbox
// they extend `AGGREGATE_TYPE_BY_EVENT`. See plan §9 / §16(1).
export const DEFAULT_AGGREGATE_TYPE = 'user';

// eventName → owning aggregate type. Catalog (Phase 12) emits two aggregates.
export const AGGREGATE_TYPE_BY_EVENT: Record<string, string> = {
  // Catalog — Restaurant aggregate
  RestaurantCreated: 'restaurant',
  RestaurantUpdated: 'restaurant',
  RestaurantStatusChanged: 'restaurant',
  CategoryAdded: 'restaurant',
  CategoryUpdated: 'restaurant',
  DeliveryZoneChanged: 'restaurant',
  // Catalog — MenuItem aggregate
  MenuItemCreated: 'menu_item',
  MenuItemUpdated: 'menu_item',
  MenuItemAvailabilityChanged: 'menu_item',
  // Fulfillment aggregate
  FulfillmentCreated: 'fulfillment',
};

/** Resolve the aggregate type for an event name, defaulting to `'user'`. */
export function resolveAggregateType(eventName: string): string {
  return AGGREGATE_TYPE_BY_EVENT[eventName] ?? DEFAULT_AGGREGATE_TYPE;
}

/** Map a domain event to a fresh PENDING outbox row. */
export function toOutboxRow(
  event: DomainEvent,
  aggregateType: string = resolveAggregateType(event.eventName),
): Omit<OutboxEventDocument, '_id'> {
  return {
    eventId: event.eventId,
    eventName: event.eventName,
    aggregateId: event.aggregateId,
    aggregateType,
    // Full serialized event — JSON round-trip strips class identity and leaves a
    // plain, replayable record for the (Phase 8) poller.
    payload: JSON.parse(JSON.stringify(event)) as Record<string, unknown>,
    status: OUTBOX_STATUS.PENDING,
    retryCount: 0,
    createdAt: new Date(),
    processedAt: null,
    // Eligible immediately; the processor reschedules this on transient failure.
    nextAttemptAt: new Date(),
    lastError: null,
  };
}

/** MongoDB duplicate-key (11000) errors, including the bulk-write variant. */
function isDuplicateKeyError(err: unknown): boolean {
  const e = err as { code?: number; writeErrors?: Array<{ code?: number; err?: { code?: number } }> };
  if (e?.code === 11000) return true;
  const writeErrors = e?.writeErrors;
  return (
    Array.isArray(writeErrors) &&
    writeErrors.length > 0 &&
    writeErrors.every((w) => w?.code === 11000 || w?.err?.code === 11000)
  );
}

export class MongoOutboxStore implements IOutboxStore {
  constructor(private readonly txContext: TransactionContext) {}

  private sessionFrom(ctx: unknown): ClientSession | undefined {
    return (ctx as ClientSession | undefined) ?? this.txContext.getSession();
  }

  async append(events: DomainEvent[], ctx: unknown): Promise<void> {
    if (events.length === 0) return;

    const rows = events.map((e) => toOutboxRow(e));
    const session = this.sessionFrom(ctx);

    try {
      await OutboxEventModel.insertMany(rows, { ordered: false, session });
    } catch (err) {
      // A pure duplicate-event re-append is an idempotent no-op; any other write
      // failure must propagate so the surrounding transaction aborts.
      if (!isDuplicateKeyError(err)) throw err;
    }
  }
}
