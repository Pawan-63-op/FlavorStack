import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ConflictError } from '../../../domain/shared/errors/ConflictError';
import { RIDER_ASSIGNMENT_STATUS } from '../../../domain/fulfillment/enums/rider-assignment-status.enum';
import { IFulfillmentRepository } from '../../../domain/fulfillment/repositories/IFulfillmentRepository';
import { IDeliveryAssignmentService } from '../../../domain/fulfillment/services/IDeliveryAssignmentService';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../shared/outbox/IOutboxStore';
import { IEventBus } from '../../shared/events/IEventBus';
import { ReassignRiderDto } from '../dtos/ReassignRiderDto';
import { FulfillmentResponse, toFulfillmentResponse } from '../responses/FulfillmentResponse';
import { AssignRider } from './AssignRider';
import { triedRiderIds, offerExpiry } from './assignment-helpers';

export class ReassignRider {
  constructor(
    private readonly fulfillmentRepo: IFulfillmentRepository,
    private readonly assignmentService: IDeliveryAssignmentService,
    private readonly unitOfWork: IUnitOfWork,
    private readonly outboxStore: IOutboxStore,
    private readonly eventBus: IEventBus,
    private readonly offerTtlSeconds: number,
    private readonly assignRider: AssignRider
  ) {}

  async execute(dto: ReassignRiderDto): Promise<Result<FulfillmentResponse>> {
    const fulfillment = await this.fulfillmentRepo.findById(dto.fulfillmentId);
    if (!fulfillment) return Result.fail(new NotFoundError('fulfillment_not_found'));

    const current = fulfillment.currentAssignment;
    const hasAcceptedRider = current?.status.value === RIDER_ASSIGNMENT_STATUS.ACCEPTED;

    if (!hasAcceptedRider) {
      return this.assignRider.execute({ fulfillmentId: dto.fulfillmentId, riderId: dto.riderId });
    }

    const newRiderId =
      dto.riderId ??
      (await this.assignmentService.pickNextRider({
        restaurantId: fulfillment.restaurantId,
        address: fulfillment.deliveryAddress,
        excludeRiderIds: triedRiderIds(fulfillment),
      }));
    if (!newRiderId) return Result.fail(new ConflictError('no_available_rider'));

    const result = fulfillment.reassign(newRiderId, offerExpiry(this.offerTtlSeconds));
    if (result.isFailure) return Result.fail(result.getError());

    const events = fulfillment.pullDomainEvents();

    await this.unitOfWork.runInTransaction(async (ctx) => {
      await this.fulfillmentRepo.update(fulfillment);
      if (events.length > 0) await this.outboxStore.append(events, ctx);
    });

    await this.eventBus.publishAll(events);

    return Result.ok(toFulfillmentResponse(fulfillment));
  }
}
