import type { ClientSession } from 'mongoose';
import { IOutboxStore } from '../../application/shared/outbox/IOutboxStore';
import { DomainEvent } from '../../domain/shared/DomainEvent';
import { TransactionContext } from './TransactionContext';
import {
  OutboxEventModel,
  OutboxEventDocument,
  OUTBOX_STATUS,
} from './models/OutboxEventModel';

export const DEFAULT_AGGREGATE_TYPE = 'user';

export const AGGREGATE_TYPE_BY_EVENT: Record<string, string> = {
  RestaurantCreated: 'restaurant',
  RestaurantUpdated: 'restaurant',
  RestaurantStatusChanged: 'restaurant',
  CategoryAdded: 'restaurant',
  CategoryUpdated: 'restaurant',
  DeliveryZoneChanged: 'restaurant',
  MenuItemCreated: 'menu_item',
  MenuItemUpdated: 'menu_item',
  MenuItemAvailabilityChanged: 'menu_item',
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
    payload: JSON.parse(JSON.stringify(event)) as Record<string, unknown>,
    status: OUTBOX_STATUS.PENDING,
    retryCount: 0,
    createdAt: new Date(),
    processedAt: null,
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
      if (!isDuplicateKeyError(err)) throw err;
    }
  }
}
