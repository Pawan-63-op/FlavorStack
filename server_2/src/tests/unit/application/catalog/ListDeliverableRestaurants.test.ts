import { CheckServiceability } from '../../../../application/catalog/use-cases/CheckServiceability';
import { ListDeliverableRestaurants } from '../../../../application/catalog/use-cases/ListDeliverableRestaurants';
import { IDeliveryZoneRepository } from '../../../../domain/catalog/repositories/IDeliveryZoneRepository';
import { ICatalogQueryRepository } from '../../../../domain/catalog/repositories/ICatalogQueryRepository';
import { DeliveryZone } from '../../../../domain/catalog/entities/DeliveryZone';
import { CatalogQueryRestaurant } from '../../../../domain/catalog/types/QueryModels';
import { RESTAURANT_STATUS } from '../../../../domain/catalog/enums/restaurant-status.enum';
import { CATALOG_VISIBILITY } from '../../../../domain/catalog/enums/catalog-visibility.enum';
import { CUISINE_TYPE } from '../../../../domain/catalog/enums/cuisine-type.enum';
import { buildPolygon, buildFeeMatrix, money } from './helpers';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';

function zone(restaurantId: string): DeliveryZone {
  return DeliveryZone.create({
    restaurantId,
    polygon: buildPolygon(),
    feeMatrix: buildFeeMatrix(),
    minOrder: money(10000),
  }).getValue();
}

function restaurant(id: string): CatalogQueryRestaurant {
  return {
    id,
    name: `R-${id}`,
    slug: `r-${id}`,
    description: null,
    cuisineTypes: [CUISINE_TYPE.NORTH_INDIAN],
    status: RESTAURANT_STATUS.ACTIVE,
    visibility: CATALOG_VISIBILITY.PUBLIC,
    imageUrl: null,
    location: { lat: 0.5, lng: 0.5 },
    openingHours: null,
    categories: [],
    deliveryZones: [],
  };
}

function queryRepo(published: Record<string, CatalogQueryRestaurant>): ICatalogQueryRepository {
  return {
    findRestaurantById: jest.fn(),
    findPublicRestaurantById: jest.fn(),
    findPublicRestaurantsByIds: jest.fn(async (ids: string[]) =>
      ids.map((id) => published[id]).filter((r): r is CatalogQueryRestaurant => Boolean(r))
    ),
    findMenuItemsByIds: jest.fn(),
    findMenuItemsByRestaurant: jest.fn(),
  } as unknown as ICatalogQueryRepository;
}

function zoneRepo(zones: DeliveryZone[]): IDeliveryZoneRepository {
  return { findZoneContaining: jest.fn(async () => zones) };
}

describe('ListDeliverableRestaurants use-case', () => {
  it('returns the distinct ids of restaurants whose zone covers the point', async () => {
    const useCase = new ListDeliverableRestaurants(
      zoneRepo([zone('rest-1'), zone('rest-2'), zone('rest-1')]),
      queryRepo({ 'rest-1': restaurant('rest-1'), 'rest-2': restaurant('rest-2') })
    );

    const result = await useCase.execute({ lat: 0.5, lng: 0.5 });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().restaurantIds).toEqual(['rest-1', 'rest-2']);
  });

  it('excludes a restaurant that is not public/active', async () => {
    const useCase = new ListDeliverableRestaurants(zoneRepo([zone('hidden-1')]), queryRepo({}));
    const result = await useCase.execute({ lat: 0.5, lng: 0.5 });
    expect(result.getValue().restaurantIds).toEqual([]);
  });

  it('does not query the catalog when no zone covers the point', async () => {
    const repo = queryRepo({});
    const result = await new ListDeliverableRestaurants(zoneRepo([]), repo).execute({
      lat: 0.5,
      lng: 0.5,
    });

    expect(result.getValue().restaurantIds).toEqual([]);
    expect(repo.findPublicRestaurantsByIds).not.toHaveBeenCalled();
  });

  it('fails with ValidationError on invalid coordinates', async () => {
    const result = await new ListDeliverableRestaurants(zoneRepo([]), queryRepo({})).execute({
      lat: 999,
      lng: 0,
    });
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });

  /**
   * The shared-helper invariant. `/catalog/deliverable` and `/catalog/serviceability` answer two
   * different questions off the same reachability rules; if `findServiceableZones` ever stopped
   * being shared, the publish gate could drift between them and browse would offer a restaurant
   * that checkout then refuses to price.
   */
  it('agrees with CheckServiceability on which restaurants are reachable', async () => {
    const zones = [zone('rest-1'), zone('rest-2'), zone('unpublished-1')];
    const published = { 'rest-1': restaurant('rest-1'), 'rest-2': restaurant('rest-2') };

    const deliverable = await new ListDeliverableRestaurants(
      zoneRepo(zones),
      queryRepo(published)
    ).execute({ lat: 0.5, lng: 0.5 });
    const serviceable = await new CheckServiceability(
      zoneRepo(zones),
      queryRepo(published)
    ).execute({ lat: 0.5, lng: 0.5, subtotalAmount: 0 });

    expect([...deliverable.getValue().restaurantIds].sort()).toEqual(
      serviceable.getValue().map((view) => view.restaurantId).sort()
    );
  });
});
