import { Result } from '../../../domain/shared/Result';
import { RIDER_ASSIGNMENT_STATUS } from '../../../domain/fulfillment/enums/rider-assignment-status.enum';
import { CANCELLED_BY } from '../../../domain/fulfillment/enums/cancelled-by.enum';
import { IFulfillmentRepository } from '../../../domain/fulfillment/repositories/IFulfillmentRepository';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IEventBus } from '../../shared/events/IEventBus';
import { AssignRider } from './AssignRider';
import { CancelFulfillment } from './CancelFulfillment';
import { logger } from '../../../infrastructure/observability/logger';

export interface HandleAssignmentTimeoutDto {
  fulfillmentId: string;
  attempt: number;
}

export class HandleAssignmentTimeout {
  constructor(
    private readonly fulfillmentRepo: IFulfillmentRepository,
    private readonly unitOfWork: IUnitOfWork,
    private readonly eventBus: IEventBus,
    private readonly assignRider: AssignRider,
    private readonly cancelFulfillment: CancelFulfillment,
    private readonly maxAssignmentAttempts: number
  ) {}

  async execute(dto: HandleAssignmentTimeoutDto): Promise<Result<void>> {
    const fulfillment = await this.fulfillmentRepo.findById(dto.fulfillmentId);
    if (!fulfillment || fulfillment.fulfillmentStatus.isTerminal()) return Result.ok<void>(undefined);

    const current = fulfillment.currentAssignment;
    if (
      !current ||
      current.status.value !== RIDER_ASSIGNMENT_STATUS.OFFERED ||
      current.attempt !== dto.attempt ||
      !current.isExpired()
    ) {
      return Result.ok<void>(undefined);
    }

    const expired = fulfillment.expireCurrentOffer();
    if (expired.isFailure) return Result.ok<void>(undefined); // lost a race; let the live state win

    const events = fulfillment.pullDomainEvents();
    await this.unitOfWork.runInTransaction(async () => {
      await this.fulfillmentRepo.update(fulfillment);
    });
    await this.eventBus.publishAll(events);

    if (fulfillment.assignmentHistory.length >= this.maxAssignmentAttempts) {
      const cancelled = await this.cancelFulfillment.execute({
        fulfillmentId: dto.fulfillmentId,
        cancelledBy: CANCELLED_BY.SYSTEM,
        reason: 'assignment_attempts_exhausted',
      });
      if (cancelled.isFailure) {
        logger.warn(
          { fulfillmentId: dto.fulfillmentId, reason: String(cancelled.getError()) },
          '[HandleAssignmentTimeout] auto-cancel after exhausting attempts failed'
        );
      }
      return Result.ok<void>(undefined);
    }

    const reoffer = await this.assignRider.execute({ fulfillmentId: dto.fulfillmentId });
    if (reoffer.isFailure) {
      logger.info(
        { fulfillmentId: dto.fulfillmentId, reason: String(reoffer.getError()) },
        '[HandleAssignmentTimeout] no rider available to re-offer after expiry'
      );
    }
    return Result.ok<void>(undefined);
  }
}
