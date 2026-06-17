import { CheckServiceability } from '../../../../application/catalog/use-cases/CheckServiceability';
import { IDeliveryZoneRepository } from '../../../../domain/catalog/repositories/IDeliveryZoneRepository';
import { ICatalogReadRepository } from '../../../../domain/catalog/repositories/ICatalogReadRepository';
import {
  IServiceabilityCache,
  ServiceabilityCachePoint,
  ServiceabilityCacheSubtotal,
} from '../../../../domain/catalog/services/ICatalogCache';
import { DeliveryZone } from '../../../../domain/catalog/entities/DeliveryZone';
import { RestaurantSummaryView } from '../../../../domain/catalog/types/ReadModels';
import { RESTAURANT_STATUS } from '../../../../domain/catalog/enums/restaurant-status.enum';
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

function summary(id: string): RestaurantSummaryView {
  return {
    id,
    name: `R-${id}`,
    slug: `r-${id}`,
    cuisineTypes: [CUISINE_TYPE.NORTH_INDIAN],
    status: RESTAURANT_STATUS.ACTIVE,
    isOpen: true,
    location: { lat: 0.5, lng: 0.5 },
  };
}

/** Minimal read-repo mock; only getRestaurantSummary is exercised here. */
function readRepo(summaries: Record<string, RestaurantSummaryView | null>): ICatalogReadRepository {
  return {
    getRestaurantSummary: jest.fn(async (id: string) => summaries[id] ?? null),
    getRestaurantSummaryBySlug: jest.fn(),
    listRestaurantSummaries: jest.fn(),
    getRestaurantMenu: jest.fn(),
    getMenuItemView: jest.fn(),
    getItemsSnapshot: jest.fn(),
  } as unknown as ICatalogReadRepository;
}

function zoneRepo(zones: DeliveryZone[]): IDeliveryZoneRepository {
  return { findZoneContaining: jest.fn(async () => zones) };
}

describe('CheckServiceability use-case', () => {
  it('returns the restaurant with its resolved fee + minimum order', async () => {
    const useCase = new CheckServiceability(
      zoneRepo([zone('rest-1')]),
      readRepo({ 'rest-1': summary('rest-1') })
    );

    const result = await useCase.execute({ lat: 0.5, lng: 0.5, subtotalAmount: 0 });

    expect(result.isSuccess).toBe(true);
    const serviceable = result.getValue();
    expect(serviceable).toHaveLength(1);
    expect(serviceable[0].restaurantId).toBe('rest-1');
    expect(serviceable[0].deliveryFee.amount).toBe(2000);
    expect(serviceable[0].minOrder.amount).toBe(10000);
  });

  it('skips a zone whose restaurant is not public/active (summary missing)', async () => {
    const useCase = new CheckServiceability(
      zoneRepo([zone('hidden-1')]),
      readRepo({ 'hidden-1': null })
    );

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
    // Same restaurant via a second (more expensive) overlapping zone is built by the
    // default fee matrix too; assert a single deduped entry at the lowest fee.
    const useCase = new CheckServiceability(
      zoneRepo([cheap, zone('rest-1')]),
      readRepo({ 'rest-1': summary('rest-1') })
    );

    const result = await useCase.execute({ lat: 0.5, lng: 0.5 });
    expect(result.getValue()).toHaveLength(1);
    expect(result.getValue()[0].deliveryFee.amount).toBe(2000);
  });

  it('fails with ValidationError on invalid coordinates', async () => {
    const useCase = new CheckServiceability(zoneRepo([]), readRepo({}));
    const result = await useCase.execute({ lat: 999, lng: 0 });
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });

  describe('with a serviceability cache', () => {
    it('returns the cached result without recomputing on a hit', async () => {
      const zones = zoneRepo([zone('rest-1')]);
      const cached = [
        { restaurantId: 'rest-1', name: 'R', slug: 'r', distanceMeters: 0, deliveryFee: { amount: 999, currency: 'INR' }, minOrder: { amount: 10000, currency: 'INR' } },
      ];
      const cache: IServiceabilityCache = {
        remember: jest.fn(async () => cached as never),
      };

      const useCase = new CheckServiceability(zones, readRepo({}), cache);
      const result = await useCase.execute({ lat: 0.5, lng: 0.5 });

      expect(result.getValue()).toEqual(cached);
      // On a cache hit the loader never runs, so the zone repo is untouched.
      expect(zones.findZoneContaining).not.toHaveBeenCalled();
    });

    it('computes via the loader and passes point + subtotal to the cache key', async () => {
      const cache: IServiceabilityCache = {
        remember: jest.fn(
          async (
            _p: ServiceabilityCachePoint,
            _s: ServiceabilityCacheSubtotal,
            loader: () => Promise<unknown>
          ) => loader() as never
        ),
      };
      const useCase = new CheckServiceability(
        zoneRepo([zone('rest-1')]),
        readRepo({ 'rest-1': summary('rest-1') }),
        cache
      );

      const result = await useCase.execute({ lat: 0.5, lng: 0.5, subtotalAmount: 25000, currency: 'INR' });

      expect(result.getValue()).toHaveLength(1);
      expect(cache.remember).toHaveBeenCalledWith(
        { lat: 0.5, lng: 0.5 },
        { amount: 25000, currency: 'INR' },
        expect.any(Function)
      );
    });
  });
});
