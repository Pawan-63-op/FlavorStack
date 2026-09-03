import { GetRestaurant } from '../../../../application/catalog/use-cases/GetRestaurant';
import { GetRestaurantMenu } from '../../../../application/catalog/use-cases/GetRestaurantMenu';
import { GetMenuItem } from '../../../../application/catalog/use-cases/GetMenuItem';
import { GetItemsSnapshot } from '../../../../application/catalog/use-cases/GetItemsSnapshot';
import { ListRestaurants } from '../../../../application/catalog/use-cases/ListRestaurants';
import { SearchRestaurants } from '../../../../application/catalog/use-cases/SearchRestaurants';
import { SearchMenuItems } from '../../../../application/catalog/use-cases/SearchMenuItems';
import { GetNearbyRestaurants } from '../../../../application/catalog/use-cases/GetNearbyRestaurants';
import { ICatalogReadRepository } from '../../../../domain/catalog/repositories/ICatalogReadRepository';
import { IDeliveryZoneRepository } from '../../../../domain/catalog/repositories/IDeliveryZoneRepository';
import { ICatalogQueryRepository } from '../../../../domain/catalog/repositories/ICatalogQueryRepository';
import { ISearchService } from '../../../../domain/catalog/services/ISearchService';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';

const emptyPage = { items: [] as never[] };

function makeReadRepo(over: Partial<Record<keyof ICatalogReadRepository, jest.Mock>> = {}): ICatalogReadRepository {
  return {
    getRestaurantSummary: jest.fn(async () => null),
    getRestaurantSummaryBySlug: jest.fn(async () => null),
    listRestaurantSummaries: jest.fn(async () => emptyPage),
    getRestaurantMenu: jest.fn(async () => null),
    getMenuItemView: jest.fn(async () => null),
    getItemsSnapshot: jest.fn(async () => []),
    ...over,
  } as unknown as ICatalogReadRepository;
}

function makeZoneRepo(zones: unknown[] = []): IDeliveryZoneRepository {
  return { findZoneContaining: jest.fn(async () => zones) } as unknown as IDeliveryZoneRepository;
}

function makeQueryRepo(
  over: Partial<Record<keyof ICatalogQueryRepository, jest.Mock>> = {}
): ICatalogQueryRepository {
  return {
    findRestaurantById: jest.fn(async () => null),
    findPublicRestaurantById: jest.fn(async () => null),
    findPublicRestaurantsByIds: jest.fn(async () => []),
    findMenuItemsByIds: jest.fn(async () => []),
    findMenuItemsByRestaurant: jest.fn(async () => []),
    ...over,
  } as unknown as ICatalogQueryRepository;
}

function makeSearch(over: Partial<Record<keyof ISearchService, jest.Mock>> = {}): ISearchService {
  return {
    searchRestaurants: jest.fn(async () => emptyPage),
    searchItems: jest.fn(async () => emptyPage),
    nearby: jest.fn(async () => emptyPage),
    ...over,
  } as unknown as ISearchService;
}

describe('GetRestaurant', () => {
  it('returns the summary when found', async () => {
    const repo = makeReadRepo({ getRestaurantSummary: jest.fn(async () => ({ id: 'r1' })) });
    const res = await new GetRestaurant(repo).execute({ restaurantId: 'r1' });
    expect(res.getValue()).toEqual({ id: 'r1' });
  });
  it('returns NotFound when missing', async () => {
    const res = await new GetRestaurant(makeReadRepo()).execute({ restaurantId: 'r1' });
    expect(res.getError()).toBeInstanceOf(NotFoundError);
  });
});

describe('GetRestaurantMenu', () => {
  it('returns the menu when found', async () => {
    const repo = makeReadRepo({ getRestaurantMenu: jest.fn(async () => ({ restaurant: {}, categories: [] })) });
    const res = await new GetRestaurantMenu(repo).execute({ restaurantId: 'r1' });
    expect(res.isSuccess).toBe(true);
  });
  it('returns NotFound when missing', async () => {
    const res = await new GetRestaurantMenu(makeReadRepo()).execute({ restaurantId: 'r1' });
    expect(res.getError()).toBeInstanceOf(NotFoundError);
  });
});

describe('GetMenuItem', () => {
  it('returns the item when found', async () => {
    const repo = makeReadRepo({ getMenuItemView: jest.fn(async () => ({ id: 'i1' })) });
    const res = await new GetMenuItem(repo).execute({ itemId: 'i1' });
    expect(res.getValue()).toEqual({ id: 'i1' });
  });
  it('returns NotFound when missing', async () => {
    const res = await new GetMenuItem(makeReadRepo()).execute({ itemId: 'i1' });
    expect(res.getError()).toBeInstanceOf(NotFoundError);
  });
});

describe('GetItemsSnapshot', () => {
  it('passes through the stored snapshot', async () => {
    const snapshot = [{ id: 'i1' }, { id: 'i2' }];
    const repo = makeReadRepo({ getItemsSnapshot: jest.fn(async () => snapshot) });
    const res = await new GetItemsSnapshot(repo).execute({ itemIds: ['i1', 'i2'] });
    expect(res.getValue()).toEqual(snapshot);
  });
});

describe('ListRestaurants', () => {
  it('delegates filter + pagination to the read repo', async () => {
    const list = jest.fn(async () => ({ items: [{ id: 'r1' }], nextCursor: 'c2' }));
    const repo = makeReadRepo({ listRestaurantSummaries: list });
    const res = await new ListRestaurants(repo, makeZoneRepo(), makeQueryRepo()).execute({
      isOpen: true,
      cursor: 'c1',
      limit: 10,
    });
    expect(res.getValue().items).toHaveLength(1);
    expect(list).toHaveBeenCalledWith(
      { cuisineTypes: undefined, isOpen: true, restaurantIds: undefined },
      { cursor: 'c1', limit: 10 }
    );
  });

  it('restricts the page to the deliverable ids when deliverableOnly is set', async () => {
    const list = jest.fn(async () => ({ items: [{ id: 'r1' }] }));
    const repo = makeReadRepo({ listRestaurantSummaries: list });
    const zones = makeZoneRepo([{ restaurantId: 'r1' }, { restaurantId: 'r2' }, { restaurantId: 'r1' }]);
    const queryRepo = makeQueryRepo({
      findPublicRestaurantsByIds: jest.fn(async () => [{ id: 'r1' }]),
    });

    const res = await new ListRestaurants(repo, zones, queryRepo).execute({
      deliverableOnly: true,
      lat: 0.5,
      lng: 0.5,
    });

    expect(res.isSuccess).toBe(true);
    // 'r2' is unpublished (absent from findPublicRestaurantsByIds), so it is not deliverable.
    expect(list).toHaveBeenCalledWith(
      { cuisineTypes: undefined, isOpen: undefined, restaurantIds: ['r1'] },
      { cursor: undefined, limit: undefined }
    );
  });

  it('returns an empty page without querying when nothing delivers to the point', async () => {
    const list = jest.fn(async () => ({ items: [{ id: 'r1' }] }));
    const repo = makeReadRepo({ listRestaurantSummaries: list });

    const res = await new ListRestaurants(repo, makeZoneRepo(), makeQueryRepo()).execute({
      deliverableOnly: true,
      lat: 0.5,
      lng: 0.5,
    });

    expect(res.getValue().items).toEqual([]);
    expect(list).not.toHaveBeenCalled();
  });

  it('rejects deliverableOnly without coordinates', async () => {
    const res = await new ListRestaurants(makeReadRepo(), makeZoneRepo(), makeQueryRepo()).execute({
      deliverableOnly: true,
    });
    expect(res.getError()).toBeInstanceOf(ValidationError);
  });
});

describe('SearchRestaurants', () => {
  it('delegates to ISearchService.searchRestaurants (defaulting empty query)', async () => {
    const search = makeSearch();
    await new SearchRestaurants(search).execute({ query: undefined as unknown as string, limit: 5 });
    expect(search.searchRestaurants).toHaveBeenCalledWith(
      '',
      { cuisineTypes: undefined, isOpenNow: undefined },
      { cursor: undefined, limit: 5 }
    );
  });
});

describe('SearchMenuItems', () => {
  it('delegates to ISearchService.searchItems', async () => {
    const search = makeSearch();
    await new SearchMenuItems(search).execute({ query: 'paneer', restaurantId: 'r1' });
    expect(search.searchItems).toHaveBeenCalledWith(
      'paneer',
      { dietary: undefined, isAvailable: undefined, restaurantId: 'r1' },
      { cursor: undefined, limit: undefined }
    );
  });
});

describe('GetNearbyRestaurants', () => {
  it('fails with ValidationError on invalid coordinates', async () => {
    const res = await new GetNearbyRestaurants(makeSearch(), makeZoneRepo(), makeQueryRepo()).execute({ lat: 999, lng: 0, radiusMeters: 1000 });
    expect(res.getError()).toBeInstanceOf(ValidationError);
  });

  it('defaults the radius when missing or below 1m', async () => {
    const search = makeSearch();
    await new GetNearbyRestaurants(search, makeZoneRepo(), makeQueryRepo()).execute({ lat: 12.9, lng: 77.5, radiusMeters: 0 });
    expect((search.nearby as jest.Mock).mock.calls[0][1]).toBe(5000); // DEFAULT_RADIUS_METERS
  });

  it('clamps the radius to the maximum', async () => {
    const search = makeSearch();
    await new GetNearbyRestaurants(search, makeZoneRepo(), makeQueryRepo()).execute({ lat: 12.9, lng: 77.5, radiusMeters: 999999 });
    expect((search.nearby as jest.Mock).mock.calls[0][1]).toBe(50000); // MAX_RADIUS_METERS
  });
});
