import { IRestaurantDirectory } from '../../application/fulfillment/ports/IRestaurantDirectory';
import { GeoPoint } from '../../domain/identity/value-objects/GeoPoint.vo';
import { IFulfillmentQueryRepository } from '../../domain/fulfillment/repositories/IFulfillmentQueryRepository';

/**
 * Stub directory for integration tests: a single restaurant owned by a single user.
 * Owner-authorisation checks in MarkPreparing / MarkReadyForPickup go through this port,
 * so tests supply the owning userId as `actorUserId`.
 */
export function makeStubRestaurantDirectory(
  restaurantId: string,
  ownerId: string,
  location: GeoPoint | null = null
): IRestaurantDirectory {
  return {
    getOwnerId: async (id: string) => (id === restaurantId ? ownerId : null),
    getLocation: async (id: string) => (id === restaurantId ? location : null),
    listRestaurantIdsByOwner: async (id: string) => (id === ownerId ? [restaurantId] : []),
    getRestaurantNames: async (ids: string[]) =>
      ids.reduce<Record<string, string>>((acc, id) => {
        if (id === restaurantId) acc[id] = 'Test Restaurant';
        return acc;
      }, {}),
    countAll: async () => 1,
  };
}

/**
 * Typed double for the read-side port (Phase 3). Lives here rather than in each suite so
 * that adding a method to `IFulfillmentQueryRepository` breaks exactly one file.
 */
export function makeQueryRepo(): jest.Mocked<IFulfillmentQueryRepository> {
  return {
    findRiderQueue: jest.fn().mockResolvedValue([]),
    findReviewSubject: jest.fn().mockResolvedValue(null),
    findRiderCompletedDeliveries: jest.fn().mockResolvedValue([]),
    findAdminDashboard: jest.fn().mockResolvedValue([]),
    aggregateAnalytics: jest.fn(),
  };
}
