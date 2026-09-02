import { Result } from '../../../domain/shared/Result';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';
import { Money } from '../../../domain/shared/Money';
import { IDeliveryZoneRepository } from '../../../domain/catalog/repositories/IDeliveryZoneRepository';
import { ICatalogQueryRepository } from '../../../domain/catalog/repositories/ICatalogQueryRepository';
import { CatalogQueryRestaurant } from '../../../domain/catalog/types/QueryModels';
import { ServiceableRestaurantView } from '../../../domain/catalog/types/ReadModels';
import { CheckServiceabilityDto } from '../dtos/QueryDtos';

export class CheckServiceability {
  constructor(
    private readonly deliveryZoneRepo: IDeliveryZoneRepository,
    private readonly queryRepo: ICatalogQueryRepository
  ) {}

  async execute(dto: CheckServiceabilityDto): Promise<Result<ServiceableRestaurantView[]>> {
    const pointResult = GeoPoint.create(dto.lat, dto.lng);
    if (pointResult.isFailure) return Result.fail(pointResult.getError());
    const point = pointResult.getValue();

    const subtotalResult = Money.create(dto.subtotalAmount ?? 0, dto.currency);
    if (subtotalResult.isFailure) return Result.fail(subtotalResult.getError());
    const subtotal = subtotalResult.getValue();

    return Result.ok(await this.resolve(point, subtotal));
  }

  private async resolve(point: GeoPoint, subtotal: Money): Promise<ServiceableRestaurantView[]> {
    const zones = await this.deliveryZoneRepo.findZoneContaining(point);
    if (zones.length === 0) return [];

    // One batched lookup instead of a sequential read per zone. `findPublicRestaurantsByIds`
    // applies the {visibility: PUBLIC, status: ACTIVE, deletedAt: null} filter, which is the
    // publish gate the old `getRestaurantSummary(...)` read enforced implicitly by returning
    // null for anything unpublished — an unpublished restaurant is simply absent here.
    const restaurantIds = [...new Set(zones.map((zone) => zone.restaurantId))];
    const restaurants = await this.queryRepo.findPublicRestaurantsByIds(restaurantIds);
    const byId = new Map<string, CatalogQueryRestaurant>(restaurants.map((r) => [r.id, r]));

    const byRestaurant = new Map<string, ServiceableRestaurantView>();

    for (const zone of zones) {
      const restaurant = byId.get(zone.restaurantId);
      if (!restaurant) continue; // not public/active → not serviceable

      const restaurantLocation = GeoPoint.create(restaurant.location.lat, restaurant.location.lng);
      if (restaurantLocation.isFailure) continue;
      const distanceMeters = restaurantLocation.getValue().distanceTo(point);

      const fee = zone.feeMatrix.feeFor(distanceMeters, subtotal);
      const candidate: ServiceableRestaurantView = {
        restaurantId: zone.restaurantId,
        name: restaurant.name,
        slug: restaurant.slug,
        distanceMeters,
        deliveryFee: { amount: fee.amount, currency: fee.currency },
        minOrder: { amount: zone.minOrder.amount, currency: zone.minOrder.currency },
      };

      const existing = byRestaurant.get(zone.restaurantId);
      if (!existing || candidate.deliveryFee.amount < existing.deliveryFee.amount) {
        byRestaurant.set(zone.restaurantId, candidate);
      }
    }

    return [...byRestaurant.values()];
  }
}
