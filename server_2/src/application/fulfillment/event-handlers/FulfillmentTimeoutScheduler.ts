// Event handler: arm BullMQ delayed jobs when the fulfillment reaches a state with a deadline
// (fulfillment_module.md §10, Phase 5B). Subscribed to the in-process bus (which OutboxProcessor also
// replays onto), so it must be idempotent — BullMQ jobId de-dup provides exactly that: a re-arm with
// the same jobId is ignored.
//
//   • RiderOffered   → assignment-timeout at expiresAt   (jobId = <id>:assignment:<attempt>)
//   • ReadyForPickup → sla-timeout for READY_FOR_PICKUP   (jobId = <id>:sla:READY_FOR_PICKUP)
//   • OutForDelivery → sla-timeout for OUT_FOR_DELIVERY   (jobId = <id>:sla:OUT_FOR_DELIVERY)
//
// Best-effort: a scheduling failure is logged, never thrown (it must not break the write path).
import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { FULFILLMENT_STATUS } from '../../../domain/fulfillment/enums/fulfillment-status.enum';
import { IFulfillmentJobScheduler } from '../jobs/FulfillmentJob';
import { logger } from '../../../infrastructure/observability/logger';

interface RiderOfferedLike extends DomainEvent {
  attempt: number;
  expiresAt: Date | string;
}

export class FulfillmentTimeoutScheduler {
  constructor(
    private readonly scheduler: IFulfillmentJobScheduler,
    private readonly readyForPickupSlaSeconds: number,
    private readonly outForDeliverySlaSeconds: number
  ) {}

  async onRiderOffered(event: DomainEvent): Promise<void> {
    const e = event as RiderOfferedLike;
    const expiresAt = e.expiresAt instanceof Date ? e.expiresAt : new Date(e.expiresAt);
    const delayMs = Math.max(0, expiresAt.getTime() - Date.now());
    await this.safeSchedule(
      { type: 'assignment-timeout', fulfillmentId: e.aggregateId, attempt: e.attempt },
      { jobId: `${e.aggregateId}:assignment:${e.attempt}`, delayMs },
      'assignment-timeout'
    );
  }

  async onReadyForPickup(event: DomainEvent): Promise<void> {
    await this.safeSchedule(
      { type: 'sla-timeout', fulfillmentId: event.aggregateId, stage: FULFILLMENT_STATUS.READY_FOR_PICKUP },
      {
        jobId: `${event.aggregateId}:sla:${FULFILLMENT_STATUS.READY_FOR_PICKUP}`,
        delayMs: this.readyForPickupSlaSeconds * 1000,
      },
      'sla-timeout(READY_FOR_PICKUP)'
    );
  }

  async onOutForDelivery(event: DomainEvent): Promise<void> {
    await this.safeSchedule(
      { type: 'sla-timeout', fulfillmentId: event.aggregateId, stage: FULFILLMENT_STATUS.OUT_FOR_DELIVERY },
      {
        jobId: `${event.aggregateId}:sla:${FULFILLMENT_STATUS.OUT_FOR_DELIVERY}`,
        delayMs: this.outForDeliverySlaSeconds * 1000,
      },
      'sla-timeout(OUT_FOR_DELIVERY)'
    );
  }

  private async safeSchedule(
    job: Parameters<IFulfillmentJobScheduler['schedule']>[0],
    opts: Parameters<IFulfillmentJobScheduler['schedule']>[1],
    label: string
  ): Promise<void> {
    try {
      await this.scheduler.schedule(job, opts);
    } catch (err) {
      logger.error({ err, jobId: opts.jobId, label }, '[FulfillmentTimeoutScheduler] failed to arm job');
    }
  }
}
