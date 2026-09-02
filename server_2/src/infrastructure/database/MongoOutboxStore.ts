import type { ClientSession } from 'mongoose';
import { IOutboxStore } from '../../application/shared/outbox/IOutboxStore';
import { DomainEvent } from '../../domain/shared/DomainEvent';
import { TransactionContext } from './TransactionContext';
import {
  OutboxEventModel,
  OutboxEventDocument,
  OUTBOX_STATUS,
} from './models/OutboxEventModel';

/**
 * Map a domain event to a fresh PENDING outbox row. Since Phase 7 the outbox carries
 * exactly one event — `OrderRequested`, appended by `Checkout` — so the aggregate type
 * is fixed rather than resolved from a lookup table.
 */
export function toOutboxRow(event: DomainEvent): Omit<OutboxEventDocument, '_id'> {
  return {
    eventId: event.eventId,
    eventName: event.eventName,
    aggregateId: event.aggregateId,
    aggregateType: 'order_request',
    payload: JSON.parse(JSON.stringify(event)) as Record<string, unknown>,
    status: OUTBOX_STATUS.PENDING,
    retryCount: 0,
    createdAt: new Date(),
    processedAt: null,
    nextAttemptAt: new Date(),
    lastError: null,
    lockedAt: null,
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
