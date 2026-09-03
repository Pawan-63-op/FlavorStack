import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { RIDER_ASSIGNMENT_STATUS } from '../../../domain/fulfillment/enums/rider-assignment-status.enum';
import { Fulfillment } from '../../../domain/fulfillment/entities/Fulfillment';
import { IFulfillmentRepository } from '../../../domain/fulfillment/repositories/IFulfillmentRepository';
import { IDeliveryAssignmentService } from '../../../domain/fulfillment/services/IDeliveryAssignmentService';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IEventBus } from '../../shared/events/IEventBus';
import { ReassignRiderDto } from '../dtos/ReassignRiderDto';
import { FulfillmentResponse, toFulfillmentResponse } from '../responses/FulfillmentResponse';
import { chooseRider, offerExpiry } from './assignment-helpers';

/**
 * Move a delivery to a different rider, whatever state the current attempt is in:
 *
 * | Current assignment | What happens |
 * |---|---|
 * | ACCEPTED | `Fulfillment.reassign` — one atomic hand-over, new rider straight to ACCEPTED |
 * | OFFERED (unanswered) | the offer is **withdrawn** to history, then re-offered to the new rider |
 * | none / inactive | a plain fresh offer |
 *
 * The OFFERED row is why this no longer delegates to `AssignRider`: delegation re-read the
 * aggregate from the repository, so a withdrawal made here would not have been visible to it, and
 * before the withdrawal existed at all `offerToRider` simply failed with
 * `ConflictError('An active rider assignment already exists')` — admins could not pull back an
 * unanswered offer.
 */
export class ReassignRider {
  constructor(
    private readonly fulfillmentRepo: IFulfillmentRepository,
    private readonly assignmentService: IDeliveryAssignmentService,
    private readonly unitOfWork: IUnitOfWork,
    private readonly eventBus: IEventBus,
    private readonly offerTtlSeconds: number,
    private readonly maxAssignmentAttempts: number
  ) {}

  async execute(dto: ReassignRiderDto): Promise<Result<FulfillmentResponse>> {
    const fulfillment = await this.fulfillmentRepo.findById(dto.fulfillmentId);
    if (!fulfillment) return Result.fail(new NotFoundError('fulfillment_not_found'));

    const mutation = await this.applyMutation(fulfillment, dto.riderId);
    if (mutation.isFailure) return Result.fail(mutation.getError());

    const events = fulfillment.pullDomainEvents();

    await this.unitOfWork.runInTransaction(async () => {
      await this.fulfillmentRepo.update(fulfillment);
    });

    await this.eventBus.publishAll(events);

    return Result.ok(toFulfillmentResponse(fulfillment));
  }

  private async applyMutation(fulfillment: Fulfillment, explicitRiderId?: string): Promise<Result<void>> {
    const current = fulfillment.currentAssignment;

    const rider = await chooseRider(
      fulfillment,
      { assignmentService: this.assignmentService, maxAssignmentAttempts: this.maxAssignmentAttempts },
      explicitRiderId
    );
    if (rider.isFailure) return Result.fail<void>(rider.getError());
    const newRiderId = rider.getValue();

    if (current?.status.value === RIDER_ASSIGNMENT_STATUS.ACCEPTED) {
      return fulfillment.reassign(newRiderId, offerExpiry(this.offerTtlSeconds));
    }

    if (current?.status.value === RIDER_ASSIGNMENT_STATUS.OFFERED) {
      const withdrawn = fulfillment.withdrawCurrentOffer();
      if (withdrawn.isFailure) return Result.fail<void>(withdrawn.getError());
    }

    return fulfillment.offerToRider(newRiderId, offerExpiry(this.offerTtlSeconds));
  }
}
