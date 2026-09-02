import type { ClientSession } from 'mongoose';
import { TransactionContext } from '../database/TransactionContext';
import {
  OutboxEventModel,
  OutboxEventDocument,
  OUTBOX_STATUS,
} from '../database/models/OutboxEventModel';

export class MongoOutboxRepository {
  constructor(private readonly txContext: TransactionContext) {}

  private get session(): ClientSession | undefined {
    return this.txContext.getSession();
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

  /**
   * Claim a row for processing: PENDING → PROCESSING, stamping the lease.
   * The `{_id, status: PENDING}` filter makes the transition atomic; returning
   * whether it actually matched is what turns it into a real lease — a second
   * relay that lost the race gets `false` and must skip the row.
   */
  async claim(id: string): Promise<boolean> {
    const result = await OutboxEventModel.updateOne(
      { _id: id, status: OUTBOX_STATUS.PENDING },
      { $set: { status: OUTBOX_STATUS.PROCESSING, lockedAt: new Date() } },
      { session: this.session },
    );
    return result.modifiedCount === 1;
  }

  /**
   * Return rows whose lease has expired to PENDING so a crashed relay cannot
   * strand them in PROCESSING forever. Returns how many were reclaimed.
   */
  async reclaimStale(leaseMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - leaseMs);
    const result = await OutboxEventModel.updateMany(
      { status: OUTBOX_STATUS.PROCESSING, lockedAt: { $lt: cutoff } },
      { $set: { status: OUTBOX_STATUS.PENDING, lockedAt: null } },
      { session: this.session },
    );
    return result.modifiedCount;
  }

  /** Settle a row: mark PROCESSED, stamp the processing time, release the lease. */
  async markProcessed(id: string): Promise<void> {
    await OutboxEventModel.updateOne(
      { _id: id },
      { $set: { status: OUTBOX_STATUS.PROCESSED, processedAt: new Date(), lockedAt: null } },
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
          lockedAt: null,
        },
      },
      { session: this.session },
    );
  }

  /** Terminal failure (retries exhausted): mark FAILED and record the last error. */
  async markFailed(id: string, lastError: string): Promise<void> {
    await OutboxEventModel.updateOne(
      { _id: id },
      { $set: { status: OUTBOX_STATUS.FAILED, lastError, lockedAt: null } },
      { session: this.session },
    );
  }
}
