import { Result } from '../../../domain/shared/Result';
import { ICatalogReadRepository } from '../../../domain/catalog/repositories/ICatalogReadRepository';
import { IDeliveryZoneRepository } from '../../../domain/catalog/repositories/IDeliveryZoneRepository';
import { ICatalogQueryRepository } from '../../../domain/catalog/repositories/ICatalogQueryRepository';
import { CursorPage } from '../../../domain/catalog/types/CursorPagination';
import { RestaurantSummaryView } from '../../../domain/catalog/types/ReadModels';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';
import { ValidationError } from '../../../domain/shared/errors/ValidationError';
import { ListRestaurantsDto } from '../dtos/QueryDtos';
import { deliverableRestaurantIds, findServiceableZones } from './serviceability-helpers';

export class ListRestaurants {
  constructor(
    private readonly readRepo: ICatalogReadRepository,
    private readonly deliveryZoneRepo: IDeliveryZoneRepository,
    private readonly queryRepo: ICatalogQueryRepository
  ) {}

  async execute(dto: ListRestaurantsDto): Promise<Result<CursorPage<RestaurantSummaryView>>> {
    let restaurantIds: string[] | undefined;

    if (dto.deliverableOnly) {
      if (dto.lat === undefined || dto.lng === undefined) {
        return Result.fail(
          new ValidationError('lat and lng are required when deliverableOnly is set')
        );
      }
      const pointResult = GeoPoint.create(dto.lat, dto.lng);
      if (pointResult.isFailure) return Result.fail(pointResult.getError());

      const matches = await findServiceableZones(
        this.deliveryZoneRepo,
        this.queryRepo,
        pointResult.getValue()
      );
      restaurantIds = deliverableRestaurantIds(matches);
      // No zone covers the point: nothing is reachable, and an empty `$in` would be a
      // no-op filter rather than an empty result.
      if (restaurantIds.length === 0) return Result.ok({ items: [] });
    }

    const page = await this.readRepo.listRestaurantSummaries(
      { cuisineTypes: dto.cuisineTypes, isOpen: dto.isOpen, restaurantIds },
      { cursor: dto.cursor, limit: dto.limit }
    );
    return Result.ok(page);
  }
}
