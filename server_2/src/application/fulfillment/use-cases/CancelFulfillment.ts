import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../domain/shared/errors/ForbiddenError';
import { IFulfillmentRepository } from '../../../domain/fulfillment/repositories/IFulfillmentRepository';
import { CANCELLED_BY, CancelledByValue } from '../../../domain/fulfillment/enums/cancelled-by.enum';
import { Fulfillment } from '../../../domain/fulfillment/entities/Fulfillment';
import { IRestaurantDirectory } from '../ports/IRestaurantDirectory';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IEventBus } from '../../shared/events/IEventBus';
import { CancelFulfillmentDto, isActorCancellation } from '../dtos/CancelFulfillmentDto';
import { FulfillmentResponse, toFulfillmentResponse } from '../responses/FulfillmentResponse';

/** What the aggregate's `cancel` needs: who is cancelling, and the id it will check ownership against. */
interface ResolvedActor {
  cancelledBy: CancelledByValue;
  actorId?: string;
}

export class CancelFulfillment {
  constructor(
    private readonly fulfillmentRepo: IFulfillmentRepository,
    private readonly restaurantDirectory: IRestaurantDirectory,
    private readonly unitOfWork: IUnitOfWork,
    private readonly eventBus: IEventBus
  ) {}

  async execute(dto: CancelFulfillmentDto): Promise<Result<FulfillmentResponse>> {
    const fulfillment = await this.fulfillmentRepo.findById(dto.fulfillmentId);
    if (!fulfillment) return Result.fail(new NotFoundError('fulfillment_not_found'));

    const actor = isActorCancellation(dto)
      ? await this.resolveActor(fulfillment, dto.actorUserId)
      : Result.ok<ResolvedActor>({ cancelledBy: dto.cancelledBy, actorId: dto.actorId });
    if (actor.isFailure) return Result.fail(actor.getError());

    const { cancelledBy, actorId } = actor.getValue();
    const result = fulfillment.cancel(cancelledBy, dto.reason, actorId);
    if (result.isFailure) return Result.fail(result.getError());

    const events = fulfillment.pullDomainEvents();

    await this.unitOfWork.runInTransaction(async () => {
      await this.fulfillmentRepo.update(fulfillment);
    });

    await this.eventBus.publishAll(events);

    return Result.ok(toFulfillmentResponse(fulfillment));
  }

  /**
   * An end user may cancel as the order's customer or as the owner of its restaurant, and nothing
   * else — a rider on this route gets an accurate refusal rather than falling through the
   * RESTAURANT branch and failing the aggregate's ownership check for the wrong reason.
   *
   * The owner branch passes `fulfillment.restaurantId` as `actorId`, not the owner's userId: the
   * aggregate compares `actorId` against its own `restaurantId`, and an owner's userId is a
   * *different* id (`CatalogRestaurantDirectory.getOwnerId` returns `restaurant.ownerId`). Passing
   * the userId is what made every owner cancellation a 403.
   */
  private async resolveActor(fulfillment: Fulfillment, actorUserId: string): Promise<Result<ResolvedActor>> {
    if (actorUserId === fulfillment.customerId) {
      return Result.ok<ResolvedActor>({ cancelledBy: CANCELLED_BY.CUSTOMER, actorId: actorUserId });
    }

    const ownerId = await this.restaurantDirectory.getOwnerId(fulfillment.restaurantId);
    if (ownerId && ownerId === actorUserId) {
      return Result.ok<ResolvedActor>({
        cancelledBy: CANCELLED_BY.RESTAURANT,
        actorId: fulfillment.restaurantId,
      });
    }

    return Result.fail(
      new ForbiddenError('Only the ordering customer or the owning restaurant can cancel this fulfillment')
    );
  }
}
