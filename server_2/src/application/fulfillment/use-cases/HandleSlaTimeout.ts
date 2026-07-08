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

    logger.warn(
      { fulfillmentId: dto.fulfillmentId, stage: dto.stage },
      '[HandleSlaTimeout] SLA breached post-pickup — flagged for admin'
    );
    return Result.ok<void>(undefined);
  }
}
