import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { IRestaurantRepository } from '../../../domain/catalog/repositories/IRestaurantRepository';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { RestaurantStatusActionDto } from '../dtos/RestaurantStatusActionDto';
import { assertRestaurantOwnership } from './shared/ownership';

/** Owner (or super-admin) write: soft-deletes a Restaurant aggregate. */
export class DeleteRestaurant {
  constructor(
    private restaurantRepo: IRestaurantRepository,
    private unitOfWork: IUnitOfWork
  ) {}

  async execute(dto: RestaurantStatusActionDto): Promise<Result<void>> {
    const restaurant = await this.restaurantRepo.findById(dto.restaurantId);
    if (!restaurant) return Result.fail(new NotFoundError('restaurant_not_found'));

    const ownership = assertRestaurantOwnership(restaurant, dto);
    if (ownership.isFailure) return Result.fail(ownership.getError());

    const softDeleteResult = restaurant.softDelete();
    if (softDeleteResult.isFailure) return Result.fail(softDeleteResult.getError());

    await this.unitOfWork.runInTransaction(async () => {
      await this.restaurantRepo.update(restaurant);
    });

    return Result.ok();
  }
}
