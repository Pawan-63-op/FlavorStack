import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../domain/shared/errors/ForbiddenError';
import { IFulfillmentRepository } from '../../../domain/fulfillment/repositories/IFulfillmentRepository';
import { IRestaurantDirectory } from '../ports/IRestaurantDirectory';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../shared/outbox/IOutboxStore';
import { IEventBus } from '../../shared/events/IEventBus';
import { MarkPreparingDto } from '../dtos/MarkPreparingDto';
import { FulfillmentResponse, toFulfillmentResponse } from '../responses/FulfillmentResponse';

export class MarkPreparing {
  constructor(
    private readonly fulfillmentRepo: IFulfillmentRepository,
    private readonly restaurantDirectory: IRestaurantDirectory,
    private readonly unitOfWork: IUnitOfWork,
    private readonly outboxStore: IOutboxStore,
    private readonly eventBus: IEventBus
  ) {}

  async execute(dto: MarkPreparingDto): Promise<Result<FulfillmentResponse>> {
    const fulfillment = await this.fulfillmentRepo.findById(dto.fulfillmentId);
    if (!fulfillment) return Result.fail(new NotFoundError('fulfillment_not_found'));

    const ownerId = await this.restaurantDirectory.getOwnerId(fulfillment.restaurantId);
    if (!ownerId || ownerId !== dto.actorUserId) {
      return Result.fail(new ForbiddenError('Only the owning restaurant can start preparation'));
    }

    const result = fulfillment.startPreparation(fulfillment.restaurantId, dto.prepEstimateMinutes);
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
