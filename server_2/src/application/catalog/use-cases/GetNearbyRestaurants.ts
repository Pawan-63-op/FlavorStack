import { Result } from '../../../domain/shared/Result';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';
import { ISearchService } from '../../../domain/catalog/services/ISearchService';
import { CursorPage } from '../../../domain/catalog/types/CursorPagination';
import { RestaurantSummaryView } from '../../../domain/catalog/types/ReadModels';
import { GetNearbyRestaurantsDto } from '../dtos/QueryDtos';

const DEFAULT_RADIUS_METERS = 5000;
const MAX_RADIUS_METERS = 50000;

export class GetNearbyRestaurants {
  constructor(private readonly searchService: ISearchService) {}

  async execute(dto: GetNearbyRestaurantsDto): Promise<Result<CursorPage<RestaurantSummaryView>>> {
    const pointResult = GeoPoint.create(dto.lat, dto.lng);
    if (pointResult.isFailure) return Result.fail(pointResult.getError());

    const radius = this.normalizeRadius(dto.radiusMeters);
    const page = await this.searchService.nearby(
      pointResult.getValue(),
      radius,
      { cuisineTypes: dto.cuisineTypes, isOpenNow: dto.isOpenNow },
      { cursor: dto.cursor, limit: dto.limit }
    );
    return Result.ok(page);
  }

  private normalizeRadius(radius?: number): number {
    if (!radius || radius < 1) return DEFAULT_RADIUS_METERS;
    return Math.min(radius, MAX_RADIUS_METERS);
  }
}
