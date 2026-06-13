// Query: which restaurants deliver to a given point, with the resolved delivery
// fee + minimum order (Catalog ↔ Cart). Combines the geo delivery-zone lookup
// (2dsphere) with the `restaurant_summary` projection — only PUBLIC + ACTIVE
// restaurants are serviceable. Zones may overlap; the lowest fee per restaurant
// wins.
import { Result } from '../../../domain/shared/Result';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';
import { Money } from '../../../domain/shared/Money';
import { IDeliveryZoneRepository } from '../../../domain/catalog/repositories/IDeliveryZoneRepository';
import { ICatalogReadRepository } from '../../../domain/catalog/repositories/ICatalogReadRepository';
import { IServiceabilityCache } from '../../../domain/catalog/services/ICatalogCache';
import { ServiceableRestaurantView } from '../../../domain/catalog/types/ReadModels';
import { CheckServiceabilityDto } from '../dtos/QueryDtos';

export class CheckServiceability {
  constructor(
    private readonly deliveryZoneRepo: IDeliveryZoneRepository,
    private readonly readRepo: ICatalogReadRepository,
    // Phase 13: optional read-through cache. Absent → always computes live (the
    // shape used by unit tests and any non-cached wiring).
    private readonly cache?: IServiceabilityCache
  ) {}

  async execute(dto: CheckServiceabilityDto): Promise<Result<ServiceableRestaurantView[]>> {
    const pointResult = GeoPoint.create(dto.lat, dto.lng);
    if (pointResult.isFailure) return Result.fail(pointResult.getError());
    const point = pointResult.getValue();

    const subtotalResult = Money.create(dto.subtotalAmount ?? 0, dto.currency);
    if (subtotalResult.isFailure) return Result.fail(subtotalResult.getError());
    const subtotal = subtotalResult.getValue();

    const compute = (): Promise<ServiceableRestaurantView[]> => this.resolve(point, subtotal);

    // Only the (valid-input) result set is cached — input-validation failures above
    // return early and are never cached.
    const views = this.cache
      ? await this.cache.remember(
          { lat: dto.lat, lng: dto.lng },
          { amount: subtotal.amount, currency: subtotal.currency },
          compute
        )
      : await compute();

    return Result.ok(views);
  }

  private async resolve(point: GeoPoint, subtotal: Money): Promise<ServiceableRestaurantView[]> {
    const zones = await this.deliveryZoneRepo.findZoneContaining(point);

    // Lowest fee per restaurant (overlapping zones resolved here).
    const byRestaurant = new Map<string, ServiceableRestaurantView>();

    for (const zone of zones) {
      const summary = await this.readRepo.getRestaurantSummary(zone.restaurantId);
      if (!summary) continue; // not public/active → not serviceable

      const restaurantLocation = GeoPoint.create(summary.location.lat, summary.location.lng);
      if (restaurantLocation.isFailure) continue;
      const distanceMeters = restaurantLocation.getValue().distanceTo(point);

      const fee = zone.feeMatrix.feeFor(distanceMeters, subtotal);
      const candidate: ServiceableRestaurantView = {
        restaurantId: zone.restaurantId,
        name: summary.name,
        slug: summary.slug,
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
