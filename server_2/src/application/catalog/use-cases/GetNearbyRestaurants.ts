import { Result } from '../../../domain/shared/Result';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';
import { ISearchService } from '../../../domain/catalog/services/ISearchService';
import { IDeliveryZoneRepository } from '../../../domain/catalog/repositories/IDeliveryZoneRepository';
import { ICatalogQueryRepository } from '../../../domain/catalog/repositories/ICatalogQueryRepository';
import { CursorPage } from '../../../domain/catalog/types/CursorPagination';
import { RestaurantSummaryView } from '../../../domain/catalog/types/ReadModels';
import { GetNearbyRestaurantsDto } from '../dtos/QueryDtos';
import { deliverableRestaurantIds, findServiceableZones } from './serviceability-helpers';

const DEFAULT_RADIUS_METERS = 5000;
const MAX_RADIUS_METERS = 50000;

export class GetNearbyRestaurants {
  constructor(
    private readonly searchService: ISearchService,
    private readonly deliveryZoneRepo: IDeliveryZoneRepository,
    private readonly queryRepo: ICatalogQueryRepository
  ) {}

  async execute(dto: GetNearbyRestaurantsDto): Promise<Result<CursorPage<RestaurantSummaryView>>> {
    const pointResult = GeoPoint.create(dto.lat, dto.lng);
    if (pointResult.isFailure) return Result.fail(pointResult.getError());
    const point = pointResult.getValue();

    // "Near you" is a radius; "delivers to you" is a polygon. A restaurant 800m away can
    // still not deliver here, so the intersection happens server-side — filtering the
    // returned page in the client would silently shrink pages and break the cursor.
    let restaurantIds: string[] | undefined;
    if (dto.deliverableOnly) {
      const matches = await findServiceableZones(this.deliveryZoneRepo, this.queryRepo, point);
      restaurantIds = deliverableRestaurantIds(matches);
      if (restaurantIds.length === 0) return Result.ok({ items: [] });
    }

    const radius = this.normalizeRadius(dto.radiusMeters);
    const page = await this.searchService.nearby(
      point,
      radius,
      { cuisineTypes: dto.cuisineTypes, isOpenNow: dto.isOpenNow, restaurantIds },
      { cursor: dto.cursor, limit: dto.limit }
    );
    return Result.ok(page);
  }

  private normalizeRadius(radius?: number): number {
    if (!radius || radius < 1) return DEFAULT_RADIUS_METERS;
    return Math.min(radius, MAX_RADIUS_METERS);
  }
}
