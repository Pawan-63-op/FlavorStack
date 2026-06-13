import { Result } from '../../../domain/shared/Result';
import { Address } from '../../../domain/identity/value-objects/Address.vo';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';
import { Restaurant } from '../../../domain/catalog/entities/Restaurant';
import { IRestaurantRepository } from '../../../domain/catalog/repositories/IRestaurantRepository';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../shared/outbox/IOutboxStore';
import { IEventBus } from '../../shared/events/IEventBus';
import { CreateRestaurantDto } from '../dtos/CreateRestaurantDto';
import { RestaurantResponse } from '../responses/RestaurantResponse';
import { toRestaurantResponse } from '../responses/mappers';

/**
 * Owner-write command: creates a new Restaurant aggregate (DRAFT/HIDDEN) owned
 * by the requesting user. `ownerId` is taken from the verified actor, never the body.
 */
export class CreateRestaurant {
  constructor(
    private restaurantRepo: IRestaurantRepository,
    private unitOfWork: IUnitOfWork,
    private outboxStore: IOutboxStore,
    private eventBus: IEventBus
  ) {}

  async execute(dto: CreateRestaurantDto): Promise<Result<RestaurantResponse>> {
    const locationResult = GeoPoint.create(dto.location.lat, dto.location.lng);
    if (locationResult.isFailure) return Result.fail(locationResult.getError());

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

    const restaurantResult = Restaurant.create({
      ownerId: dto.actorId,
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      cuisineTypes: dto.cuisineTypes,
      address: addressResult.getValue(),
      location: locationResult.getValue(),
      phone: dto.phone,
      imageUrl: dto.imageUrl,
    });
    if (restaurantResult.isFailure) return Result.fail(restaurantResult.getError());

    const restaurant = restaurantResult.getValue();
    const events = restaurant.pullDomainEvents();

    // Transaction boundary: persist the new Restaurant aggregate and its outbox
    // row atomically. Domain events are published only after a successful commit.
    await this.unitOfWork.runInTransaction(async (ctx) => {
      await this.restaurantRepo.save(restaurant);
      if (events.length > 0) {
        await this.outboxStore.append(events, ctx);
      }
    });

    await this.eventBus.publishAll(events);

    return Result.ok(toRestaurantResponse(restaurant));
  }
}
