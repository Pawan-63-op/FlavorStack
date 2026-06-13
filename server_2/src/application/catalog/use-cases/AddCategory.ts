import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { IRestaurantRepository } from '../../../domain/catalog/repositories/IRestaurantRepository';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../shared/outbox/IOutboxStore';
import { IEventBus } from '../../shared/events/IEventBus';
import { AddCategoryDto } from '../dtos/AddCategoryDto';
import { RestaurantResponse } from '../responses/RestaurantResponse';
import { toRestaurantResponse } from '../responses/mappers';
import { assertRestaurantOwnership } from './shared/ownership';

/** Owner (or super-admin) write: appends a menu category to the restaurant. */
export class AddCategory {
  constructor(
    private restaurantRepo: IRestaurantRepository,
    private unitOfWork: IUnitOfWork,
    private outboxStore: IOutboxStore,
    private eventBus: IEventBus
  ) {}

  async execute(dto: AddCategoryDto): Promise<Result<RestaurantResponse>> {
    const restaurant = await this.restaurantRepo.findById(dto.restaurantId);
    if (!restaurant) return Result.fail(new NotFoundError('restaurant_not_found'));

    const ownership = assertRestaurantOwnership(restaurant, dto);
    if (ownership.isFailure) return Result.fail(ownership.getError());

    const addResult = restaurant.addCategory(dto.label, dto.sortOrder);
    if (addResult.isFailure) return Result.fail(addResult.getError());

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
