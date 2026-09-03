import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { IFulfillmentRepository } from '../../../domain/fulfillment/repositories/IFulfillmentRepository';
import { IDeliveryAssignmentService } from '../../../domain/fulfillment/services/IDeliveryAssignmentService';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IEventBus } from '../../shared/events/IEventBus';
import { AssignRiderDto } from '../dtos/AssignRiderDto';
import { FulfillmentResponse, toFulfillmentResponse } from '../responses/FulfillmentResponse';
import { chooseRider, offerExpiry } from './assignment-helpers';

/**
 * Offer a fulfillment to a rider — the next available candidate, or the one an admin named.
 * The sole entry point for making an offer: the auto-offer on `ReadyForPickup`, the re-offer after
 * a rejection, and the re-offer after an expiry all land here.
 */
export class AssignRider {
  constructor(
    private readonly fulfillmentRepo: IFulfillmentRepository,
    private readonly assignmentService: IDeliveryAssignmentService,
    private readonly unitOfWork: IUnitOfWork,
    private readonly eventBus: IEventBus,
    private readonly offerTtlSeconds: number,
    private readonly maxAssignmentAttempts: number
  ) {}

  async execute(dto: AssignRiderDto): Promise<Result<FulfillmentResponse>> {
    const fulfillment = await this.fulfillmentRepo.findById(dto.fulfillmentId);
    if (!fulfillment) return Result.fail(new NotFoundError('fulfillment_not_found'));

    const rider = await chooseRider(
      fulfillment,
      { assignmentService: this.assignmentService, maxAssignmentAttempts: this.maxAssignmentAttempts },
      dto.riderId
    );
    if (rider.isFailure) return Result.fail(rider.getError());

    const result = fulfillment.offerToRider(rider.getValue(), offerExpiry(this.offerTtlSeconds));
    if (result.isFailure) return Result.fail(result.getError());

    const events = fulfillment.pullDomainEvents();

    await this.unitOfWork.runInTransaction(async () => {
      await this.fulfillmentRepo.update(fulfillment);
    });

    await this.eventBus.publishAll(events);

    return Result.ok(toFulfillmentResponse(fulfillment));
  }
}
