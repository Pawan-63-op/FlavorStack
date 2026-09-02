import { CheckServiceability } from '../../../../application/catalog/use-cases/CheckServiceability';
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
    feeMatrix: buildFeeMatrix(), // flat 2000 paise up to 2000m, no free threshold
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

/**
 * Minimal query-repo mock; only `findPublicRestaurantsByIds` is exercised here. It
 * mirrors the real repository's publish gate: an id absent from `published` is simply
 * omitted from the result, which is how a non-public restaurant becomes unserviceable.
 */
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

describe('CheckServiceability use-case', () => {
  it('returns the restaurant with its resolved fee + minimum order', async () => {
    const useCase = new CheckServiceability(
      zoneRepo([zone('rest-1')]),
      queryRepo({ 'rest-1': restaurant('rest-1') })
    );

    const result = await useCase.execute({ lat: 0.5, lng: 0.5, subtotalAmount: 0 });

    expect(result.isSuccess).toBe(true);
    const serviceable = result.getValue();
    expect(serviceable).toHaveLength(1);
    expect(serviceable[0].restaurantId).toBe('rest-1');
    expect(serviceable[0].deliveryFee.amount).toBe(2000);
    expect(serviceable[0].minOrder.amount).toBe(10000);
  });

  it('skips a zone whose restaurant is not public/active (filtered out by the query)', async () => {
    const useCase = new CheckServiceability(zoneRepo([zone('hidden-1')]), queryRepo({}));

    const result = await useCase.execute({ lat: 0.5, lng: 0.5 });
    expect(result.getValue()).toHaveLength(0);
  });

  it('keeps the lowest fee when overlapping zones resolve the same restaurant', async () => {
    const cheap = DeliveryZone.create({
      restaurantId: 'rest-1',
      polygon: buildPolygon(),
      feeMatrix: buildFeeMatrix(), // 2000
      minOrder: money(10000),
    }).getValue();
    const useCase = new CheckServiceability(
      zoneRepo([cheap, zone('rest-1')]),
      queryRepo({ 'rest-1': restaurant('rest-1') })
    );

    const result = await useCase.execute({ lat: 0.5, lng: 0.5 });
    expect(result.getValue()).toHaveLength(1);
    expect(result.getValue()[0].deliveryFee.amount).toBe(2000);
  });

  it('fails with ValidationError on invalid coordinates', async () => {
    const useCase = new CheckServiceability(zoneRepo([]), queryRepo({}));
    const result = await useCase.execute({ lat: 999, lng: 0 });
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });

  it('resolves overlapping zones with one batched, de-duplicated restaurant lookup', async () => {
    const repo = queryRepo({ 'rest-1': restaurant('rest-1'), 'rest-2': restaurant('rest-2') });
    const useCase = new CheckServiceability(
      zoneRepo([zone('rest-1'), zone('rest-2'), zone('rest-1')]),
      repo
    );

    const result = await useCase.execute({ lat: 0.5, lng: 0.5 });

    expect(result.getValue()).toHaveLength(2);
    expect(repo.findPublicRestaurantsByIds).toHaveBeenCalledTimes(1);
    expect(repo.findPublicRestaurantsByIds).toHaveBeenCalledWith(['rest-1', 'rest-2']);
  });

  it('does not query the catalog when no zone covers the point', async () => {
    const repo = queryRepo({});
    const useCase = new CheckServiceability(zoneRepo([]), repo);

    const result = await useCase.execute({ lat: 0.5, lng: 0.5 });

    expect(result.getValue()).toHaveLength(0);
    expect(repo.findPublicRestaurantsByIds).not.toHaveBeenCalled();
  });
});
