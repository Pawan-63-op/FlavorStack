// Read / processing side of the transactional outbox (Phase 6, Batch 6).
//
// The write side (MongoOutboxStore) appends PENDING rows inside the business
// transaction. This repository is consumed by the (Phase 8) OutboxPoller to drain
// them:
//
//   findPending(limit)   → oldest PENDING rows (served by the {status,createdAt} index)
//   markProcessing(id)   → claim a row: PENDING → PROCESSING
//   markProcessed(id)    → settle a row: → PROCESSED, stamp processedAt
//
// `save` persists a single event row (the per-event analogue of the store's bulk
// `append`), kept here so the processing side has a complete, self-contained API.
//
// Session propagation mirrors the other Mongo repositories: the active
// ClientSession is read implicitly from the shared TransactionContext and
// attached to every operation. Poller calls run outside a transaction, where
// getSession() is undefined and operations use the default auto-committed session.
import type { ClientSession } from 'mongoose';
import { DomainEvent } from '../../domain/shared/DomainEvent';
import { TransactionContext } from '../database/TransactionContext';
import {
  OutboxEventModel,
  OutboxEventDocument,
  OUTBOX_STATUS,
} from '../database/models/OutboxEventModel';
import { toOutboxRow } from '../database/MongoOutboxStore';

export class MongoOutboxRepository {
  constructor(private readonly txContext: TransactionContext) {}

  private get session(): ClientSession | undefined {
    return this.txContext.getSession();
  }

  /** Persist a single PENDING outbox row for an event. */
  async save(event: DomainEvent, aggregateType?: string): Promise<void> {
    const row = toOutboxRow(event, aggregateType);
    await OutboxEventModel.create([row], { session: this.session });
  }

  /**
   * Oldest due PENDING rows first, capped at `limit`. Gated on
   * `nextAttemptAt <= now` so backed-off rows wait their turn (uses the
   * {status, nextAttemptAt} index). Sorted by nextAttemptAt so the longest-due
   * work drains first.
   */
  async findPending(limit = 100): Promise<OutboxEventDocument[]> {
    return OutboxEventModel.find(
      { status: OUTBOX_STATUS.PENDING, nextAttemptAt: { $lte: new Date() } },
      null,
      { session: this.session },
    )
      .sort({ nextAttemptAt: 1 })
      .limit(limit)
      .lean<OutboxEventDocument[]>();
  }

  /** Claim a row for processing: PENDING → PROCESSING. */
  async markProcessing(id: string): Promise<void> {
    await OutboxEventModel.updateOne(
      { _id: id, status: OUTBOX_STATUS.PENDING },
      { $set: { status: OUTBOX_STATUS.PROCESSING } },
      { session: this.session },
    );
  }

  /** Settle a row: mark PROCESSED and stamp the processing time. */
  async markProcessed(id: string): Promise<void> {
    await OutboxEventModel.updateOne(
      { _id: id },
      { $set: { status: OUTBOX_STATUS.PROCESSED, processedAt: new Date() } },
      { session: this.session },
    );
  }

  /**
   * Transient failure with retries remaining: return the row to PENDING, persist
   * the bumped retryCount, the backed-off nextAttemptAt and the last error so the
   * schedule survives restarts.
   */
  async recordFailure(
    id: string,
    update: { retryCount: number; nextAttemptAt: Date; lastError: string },
  ): Promise<void> {
    await OutboxEventModel.updateOne(
      { _id: id },
      {
        $set: {
          status: OUTBOX_STATUS.PENDING,
          retryCount: update.retryCount,
          nextAttemptAt: update.nextAttemptAt,
          lastError: update.lastError,
        },
      },
      { session: this.session },
    );
  }

  /** Terminal failure (retries exhausted): mark FAILED and record the last error. */
  async markFailed(id: string, lastError: string): Promise<void> {
    await OutboxEventModel.updateOne(
      { _id: id },
      { $set: { status: OUTBOX_STATUS.FAILED, lastError } },
      { session: this.session },
    );
  }
}
