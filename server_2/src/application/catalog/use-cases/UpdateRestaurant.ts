import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { Address } from '../../../domain/identity/value-objects/Address.vo';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';
import { IRestaurantRepository } from '../../../domain/catalog/repositories/IRestaurantRepository';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IEventBus } from '../../shared/events/IEventBus';
import { UpdateRestaurantDto } from '../dtos/UpdateRestaurantDto';
import { RestaurantResponse } from '../responses/RestaurantResponse';
import { toRestaurantResponse } from '../responses/mappers';
import { assertRestaurantOwnership } from './shared/ownership';

/** Owner (or super-admin) write: updates Restaurant profile fields. */
export class UpdateRestaurant {
  constructor(
    private restaurantRepo: IRestaurantRepository,
    private unitOfWork: IUnitOfWork,
    private eventBus: IEventBus
  ) {}

  async execute(dto: UpdateRestaurantDto): Promise<Result<RestaurantResponse>> {
    const restaurant = await this.restaurantRepo.findById(dto.restaurantId);
    if (!restaurant) return Result.fail(new NotFoundError('restaurant_not_found'));

    const ownership = assertRestaurantOwnership(restaurant, dto);
    if (ownership.isFailure) return Result.fail(ownership.getError());

    let location: GeoPoint | undefined;
    if (dto.location) {
      const locationResult = GeoPoint.create(dto.location.lat, dto.location.lng);
      if (locationResult.isFailure) return Result.fail(locationResult.getError());
      location = locationResult.getValue();
    }

    let address: Address | undefined;
    if (dto.address) {
      const addressGeoResult = GeoPoint.create(dto.address.coordinates.lat, dto.address.coordinates.lng);
      if (addressGeoResult.isFailure) return Result.fail(addressGeoResult.getError());

      const addressResult = Address.create({
        label: dto.address.label,
        street: dto.address.street,
        city: dto.address.city,
        state: dto.address.state,
        pinCode: dto.address.pinCode,
        coordinates: addressGeoResult.getValue(),
      });
      if (addressResult.isFailure) return Result.fail(addressResult.getError());
      address = addressResult.getValue();
    }

    const updateResult = restaurant.updateProfile({
      name: dto.name,
      description: dto.description,
      cuisineTypes: dto.cuisineTypes,
      address,
      location,
      phone: dto.phone,
      imageUrl: dto.imageUrl,
    });
    if (updateResult.isFailure) return Result.fail(updateResult.getError());

    const events = restaurant.pullDomainEvents();

    await this.unitOfWork.runInTransaction(async () => {
      await this.restaurantRepo.update(restaurant);
    });

    await this.eventBus.publishAll(events);

    return Result.ok(toRestaurantResponse(restaurant));
  }
}
