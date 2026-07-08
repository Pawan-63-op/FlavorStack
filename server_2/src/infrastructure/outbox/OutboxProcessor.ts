import { DomainEvent } from '../../domain/shared/DomainEvent';
import { IEventBus } from '../../application/shared/events/IEventBus';
import { OutboxConfig } from '../../config/outbox';
import { logger } from '../observability/logger';
import { MongoOutboxRepository } from '../repositories/OutboxRepository';
import { OutboxEventDocument } from '../database/models/OutboxEventModel';

export class OutboxProcessor {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private inFlight: Promise<void> = Promise.resolve();

  constructor(
    private readonly repo: MongoOutboxRepository,
    private readonly eventBus: IEventBus,
    private readonly config: OutboxConfig,
  ) {}

  /** Begin polling. Uses setTimeout re-arm (not setInterval) so a long batch
   *  never overlaps the next poll. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleNext();
  }

  /** Stop polling and let the in-flight batch drain (graceful shutdown). */
  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.inFlight;
  }

  private scheduleNext(): void {
    if (!this.running) return;
    this.timer = setTimeout(() => {
      this.inFlight = this.processBatch()
        .catch((err) => {
          logger.error({ err }, '[OutboxProcessor] batch failed');
        })
        .finally(() => this.scheduleNext());
    }, this.config.pollIntervalMs);
  }

  /** Drain one batch of due rows. Public so callers/tests can run a single,
   *  deterministic tick without the timer. */
  async processBatch(): Promise<void> {
    const rows = await this.repo.findPending(this.config.batchSize);
    for (const row of rows) {
      await this.processRow(row);
    }
  }

  private async processRow(row: OutboxEventDocument): Promise<void> {
    const id = String(row._id);
    try {
      await this.repo.markProcessing(id);
      await this.eventBus.publish(this.toDomainEvent(row));
      await this.repo.markProcessed(id);
    } catch (err) {
      await this.handleFailure(row, err);
    }
  }

  private async handleFailure(row: OutboxEventDocument, err: unknown): Promise<void> {
    const id = String(row._id);
    const message = err instanceof Error ? err.message : String(err);
    const attempts = row.retryCount + 1;

    if (attempts >= this.config.maxRetries) {
      logger.error(
        { outboxId: id, eventName: row.eventName, attempts, err: message },
        '[OutboxProcessor] retries exhausted — marking FAILED',
      );
      await this.repo.markFailed(id, message);
      return;
    }

    const nextAttemptAt = new Date(Date.now() + this.backoffMs(row.retryCount));
    logger.warn(
      { outboxId: id, eventName: row.eventName, attempts, nextAttemptAt, err: message },
      '[OutboxProcessor] transient failure — scheduling retry',
    );
    await this.repo.recordFailure(id, { retryCount: attempts, nextAttemptAt, lastError: message });
  }

  /** Exponential backoff: base * 2^retryCount, plus up to one full base of jitter
   *  to avoid thundering-herd retries across rows. */
  private backoffMs(retryCount: number): number {
    const delay = this.config.backoffBaseMs * 2 ** retryCount;
    const jitter = Math.floor(Math.random() * this.config.backoffBaseMs);
    return delay + jitter;
  }

  /** Rehydrate a replayable DomainEvent from the stored row. The payload is the
   *  JSON-serialized event; we reassert the canonical fields from the row. */
  private toDomainEvent(row: OutboxEventDocument): DomainEvent {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    return {
      ...payload,
      eventId: row.eventId,
      eventName: row.eventName,
      aggregateId: row.aggregateId,
      occurredOn: payload.occurredOn ? new Date(payload.occurredOn as string) : new Date(),
    };
  }
}
