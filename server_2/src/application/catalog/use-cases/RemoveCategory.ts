import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { IRestaurantRepository } from '../../../domain/catalog/repositories/IRestaurantRepository';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../shared/outbox/IOutboxStore';
import { IEventBus } from '../../shared/events/IEventBus';
import { RemoveCategoryDto } from '../dtos/RemoveCategoryDto';
import { RestaurantResponse } from '../responses/RestaurantResponse';
import { toRestaurantResponse } from '../responses/mappers';
import { assertRestaurantOwnership } from './shared/ownership';

/** Owner (or super-admin) write: removes a category from the restaurant. */
export class RemoveCategory {
  constructor(
    private restaurantRepo: IRestaurantRepository,
    private unitOfWork: IUnitOfWork,
    private outboxStore: IOutboxStore,
    private eventBus: IEventBus
  ) {}

  async execute(dto: RemoveCategoryDto): Promise<Result<RestaurantResponse>> {
    const restaurant = await this.restaurantRepo.findById(dto.restaurantId);
    if (!restaurant) return Result.fail(new NotFoundError('restaurant_not_found'));

    const ownership = assertRestaurantOwnership(restaurant, dto);
    if (ownership.isFailure) return Result.fail(ownership.getError());

    const removeResult = restaurant.removeCategory(dto.categoryId);
    if (removeResult.isFailure) return Result.fail(removeResult.getError());

    const events = restaurant.pullDomainEvents();

    await this.unitOfWork.runInTransaction(async (ctx) => {
      await this.restaurantRepo.update(restaurant);
      if (events.length > 0) {
        await this.outboxStore.append(events, ctx);
      }
    });

    await this.eventBus.publishAll(events);

    return Result.ok(toRestaurantResponse(restaurant));
  }
}
