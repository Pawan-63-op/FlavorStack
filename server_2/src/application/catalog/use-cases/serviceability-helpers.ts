import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';
import { DeliveryZone } from '../../../domain/catalog/entities/DeliveryZone';
import { IDeliveryZoneRepository } from '../../../domain/catalog/repositories/IDeliveryZoneRepository';
import { ICatalogQueryRepository } from '../../../domain/catalog/repositories/ICatalogQueryRepository';
import { CatalogQueryRestaurant } from '../../../domain/catalog/types/QueryModels';

/** A delivery zone covering the queried point, paired with its published restaurant. */
export interface ServiceableZone {
  zone: DeliveryZone;
  restaurant: CatalogQueryRestaurant;
}

/**
 * The half of serviceability that is purely about *reachability*: which zones cover the
 * point, and which of their restaurants are published. `CheckServiceability` continues
 * from here into pricing (`Money`/`feeFor`); `ListDeliverableRestaurants` and the
 * `deliverableOnly` browse filter stop here. Shared so the publish-gate rules
 * (`findPublicRestaurantsByIds` applies PUBLIC + ACTIVE + not-deleted) cannot diverge
 * between the two questions.
 *
 * Zones are returned in repository order, one entry per covering zone — a restaurant
 * with two overlapping zones appears twice, which is what the fee reduction needs.
 */
export async function findServiceableZones(
  deliveryZoneRepo: IDeliveryZoneRepository,
  queryRepo: ICatalogQueryRepository,
  point: GeoPoint
): Promise<ServiceableZone[]> {
  const zones = await deliveryZoneRepo.findZoneContaining(point);
  if (zones.length === 0) return [];

  // One batched lookup instead of a sequential read per zone.
  const restaurantIds = [...new Set(zones.map((zone) => zone.restaurantId))];
  const restaurants = await queryRepo.findPublicRestaurantsByIds(restaurantIds);
  const byId = new Map<string, CatalogQueryRestaurant>(restaurants.map((r) => [r.id, r]));

  const matches: ServiceableZone[] = [];
  for (const zone of zones) {
    const restaurant = byId.get(zone.restaurantId);
    if (!restaurant) continue; // not public/active → not serviceable
    matches.push({ zone, restaurant });
  }
  return matches;
}

/** Distinct restaurant ids from `findServiceableZones`, order-preserving. */
export function deliverableRestaurantIds(matches: ServiceableZone[]): string[] {
  return [...new Set(matches.map((match) => match.zone.restaurantId))];
}
