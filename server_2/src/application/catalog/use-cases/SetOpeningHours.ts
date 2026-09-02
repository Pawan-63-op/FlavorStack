import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { OpeningHours } from '../../../domain/catalog/value-objects/OpeningHours.vo';
import { IRestaurantRepository } from '../../../domain/catalog/repositories/IRestaurantRepository';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IEventBus } from '../../shared/events/IEventBus';
import { SetOpeningHoursDto } from '../dtos/SetOpeningHoursDto';
import { RestaurantResponse } from '../responses/RestaurantResponse';
import { toRestaurantResponse } from '../responses/mappers';
import { assertRestaurantOwnership } from './shared/ownership';

/**
 * Owner (or super-admin) write: replaces the Restaurant's weekly schedule + holidays.
 * Read-model `isOpen` projections are invalidated by the ReadModelProjector reacting
 * to RestaurantUpdated, not here.
 */
export class SetOpeningHours {
  constructor(
    private restaurantRepo: IRestaurantRepository,
    private unitOfWork: IUnitOfWork,
    private eventBus: IEventBus
  ) {}

  async execute(dto: SetOpeningHoursDto): Promise<Result<RestaurantResponse>> {
    const restaurant = await this.restaurantRepo.findById(dto.restaurantId);
    if (!restaurant) return Result.fail(new NotFoundError('restaurant_not_found'));

    const ownership = assertRestaurantOwnership(restaurant, dto);
    if (ownership.isFailure) return Result.fail(ownership.getError());

    const openingHoursResult = OpeningHours.create({ schedule: dto.schedule, holidays: dto.holidays ?? [] });
    if (openingHoursResult.isFailure) return Result.fail(openingHoursResult.getError());

    const setResult = restaurant.setOpeningHours(openingHoursResult.getValue());
    if (setResult.isFailure) return Result.fail(setResult.getError());

    const events = restaurant.pullDomainEvents();

    await this.unitOfWork.runInTransaction(async () => {
      await this.restaurantRepo.update(restaurant);
    });

    await this.eventBus.publishAll(events);

    return Result.ok(toRestaurantResponse(restaurant));
  }
}
