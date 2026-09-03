import { IDriverRepository } from '../../domain/identity/repositories/IDriverRepository';
import { GeoPoint } from '../../domain/identity/value-objects/GeoPoint.vo';
import { Driver } from '../../domain/identity/entities/Driver';
import { AvailableRidersProvider } from './SimpleDeliveryAssignmentService';

/** Resolves where a restaurant is, so riders can be ranked by distance from the pickup point. */
export type RestaurantLocator = (restaurantId: string) => Promise<GeoPoint | null>;

function eligible(drivers: Driver[]): string[] {
  return drivers.filter((d) => d.isOnline && !d.isBusy).map((d) => d._id);
}

/**
 * The candidate list behind every rider offer, **nearest to the restaurant first**.
 *
 * `findNearby` is a `$near` query, so Mongo returns it already sorted by distance; the online /
 * not-busy filter is applied afterwards because the geo index carries neither field. Two fallbacks
 * keep an offer possible rather than correct-but-empty: an unknown restaurant location, or no
 * eligible driver inside `radiusMeters`, both degrade to the unranked platform-wide available list.
 * Until Phase 10.4 that global list was the *only* behaviour — `findNearby` was defined and never
 * called, and `restaurantId` was ignored outright.
 */
export function createAvailableDriversProvider(
  driverRepo: IDriverRepository,
  locate: RestaurantLocator,
  radiusMeters: number
): AvailableRidersProvider {
  return async (restaurantId: string): Promise<string[]> => {
    const location = await locate(restaurantId);

    if (location) {
      const nearby = eligible(await driverRepo.findNearby(location, radiusMeters));
      if (nearby.length > 0) return nearby;
    }

    return eligible(await driverRepo.findAvailable());
  };
}
