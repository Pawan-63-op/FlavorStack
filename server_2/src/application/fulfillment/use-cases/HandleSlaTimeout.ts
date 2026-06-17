// UC: HandleSlaTimeout — the brain behind the SLA-timeout job (fulfillment_module.md §10, Phase 5B).
// Driven by a BullMQ delayed job armed at a stage's SLA deadline (READY_FOR_PICKUP / OUT_FOR_DELIVERY).
//
// Sequence — sla breach → auto-cancel:
//
//   Job(fire@deadline)        HandleSlaTimeout            Fulfillment(agg)
//        │  {fulfillmentId, stage}  │                         │
//        │─────────────────────────▶│ findById                │
//        │                          │────────────────────────▶│
//        │   advanced past `stage`? → idempotent no-op (SLA met)
//        │   still at `stage`:                                  │
//        │     pre-pickup  → CancelFulfillment(SYSTEM) ────────▶│ FulfillmentCancelled  [CANCELLED]
//        │     post-pickup → flag for admin (log; no cancel — can't cancel after pickup, §3.2)
//
// Idempotency/version guards: the handler compares the live fulfillment status to the `stage` the
// timer was armed at; if the order advanced, the SLA was met and the job is a no-op. The auto-cancel
// itself is guarded by CancelFulfillment + the aggregate's cancellation window (terminal = no-op).
import { Result } from '../../../domain/shared/Result';
import { FULFILLMENT_STATUS } from '../../../domain/fulfillment/enums/fulfillment-status.enum';
import { CANCELLED_BY } from '../../../domain/fulfillment/enums/cancelled-by.enum';
import { IFulfillmentRepository } from '../../../domain/fulfillment/repositories/IFulfillmentRepository';
import { CancelFulfillment } from './CancelFulfillment';
import { logger } from '../../../infrastructure/observability/logger';

export interface HandleSlaTimeoutDto {
  fulfillmentId: string;
  stage: string;
}

// Statuses from which a SYSTEM auto-cancel is still permitted (the cancellation window, §3.2 / §4.1).
const PRE_PICKUP_CANCELLABLE: string[] = [
  FULFILLMENT_STATUS.CREATED,
  FULFILLMENT_STATUS.PREPARING,
  FULFILLMENT_STATUS.READY_FOR_PICKUP,
];

export class HandleSlaTimeout {
  constructor(
    private readonly fulfillmentRepo: IFulfillmentRepository,
    private readonly cancelFulfillment: CancelFulfillment
  ) {}

  async execute(dto: HandleSlaTimeoutDto): Promise<Result<void>> {
    const fulfillment = await this.fulfillmentRepo.findById(dto.fulfillmentId);
    if (!fulfillment || fulfillment.fulfillmentStatus.isTerminal()) return Result.ok<void>(undefined);

    // Order advanced past the stage this SLA timer guarded → SLA met, nothing to do.
    if (fulfillment.fulfillmentStatus.value !== dto.stage) return Result.ok<void>(undefined);

    if (PRE_PICKUP_CANCELLABLE.includes(fulfillment.fulfillmentStatus.value)) {
      const cancelled = await this.cancelFulfillment.execute({
        fulfillmentId: dto.fulfillmentId,
        cancelledBy: CANCELLED_BY.SYSTEM,
        reason: `sla_timeout_${dto.stage.toLowerCase()}`,
      });
      if (cancelled.isFailure) {
        logger.warn(
          { fulfillmentId: dto.fulfillmentId, stage: dto.stage, reason: String(cancelled.getError()) },
          '[HandleSlaTimeout] SLA auto-cancel failed'
        );
      }
      return Result.ok<void>(undefined);
    }

    // Post-pickup: cannot cancel (§3.2). Flag for the admin dashboard (Phase 6 surfaces SLA breaches).
    logger.warn(
      { fulfillmentId: dto.fulfillmentId, stage: dto.stage },
      '[HandleSlaTimeout] SLA breached post-pickup — flagged for admin'
    );
    return Result.ok<void>(undefined);
  }
}
