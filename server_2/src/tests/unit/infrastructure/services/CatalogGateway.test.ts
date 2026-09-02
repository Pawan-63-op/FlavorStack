import { CatalogGateway } from '../../../../infrastructure/services/CatalogGateway';
import { Money } from '../../../../domain/shared/Money';
import { Result } from '../../../../domain/shared/Result';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { GeoPoint } from '../../../../domain/identity/value-objects/GeoPoint.vo';
import { RESTAURANT_STATUS } from '../../../../domain/catalog/enums/restaurant-status.enum';
import { COMMERCE_RESTAURANT_STATUS } from '../../../../domain/commerce/enums/restaurant-status.enum';
import {
  ICatalogReadRepository,
  ListRestaurantsFilter,
} from '../../../../domain/catalog/repositories/ICatalogReadRepository';
import {
  RestaurantSummaryView,
  RestaurantMenuView,
  MenuItemView,
  ServiceableRestaurantView,
} from '../../../../domain/catalog/types/ReadModels';
import { CursorPage, CursorPaginationParams } from '../../../../domain/catalog/types/CursorPagination';
import { ICatalogQueryRepository } from '../../../../domain/catalog/repositories/ICatalogQueryRepository';
import {
  CatalogQueryMenuItem,
  CatalogQueryRestaurant,
} from '../../../../domain/catalog/types/QueryModels';
import { CATALOG_VISIBILITY } from '../../../../domain/catalog/enums/catalog-visibility.enum';
import { VARIANT_SELECTION_TYPE } from '../../../../domain/catalog/enums/variant-selection-type.enum';
import { CheckServiceabilityDto } from '../../../../application/catalog/dtos/QueryDtos';


class FakeCatalogReadRepository implements ICatalogReadRepository {
  constructor(
    private readonly summaries: Record<string, RestaurantSummaryView> = {},
    private readonly items: Record<string, MenuItemView> = {}
  ) {}

  async getRestaurantSummary(restaurantId: string): Promise<RestaurantSummaryView | null> {
    return this.summaries[restaurantId] ?? null;
  }
  async getRestaurantSummaryBySlug(): Promise<RestaurantSummaryView | null> {
    return null;
  }
  async listRestaurantSummaries(
    _filter: ListRestaurantsFilter,
    _params: CursorPaginationParams
  ): Promise<CursorPage<RestaurantSummaryView>> {
    return { items: [] };
  }
  async getRestaurantMenu(): Promise<RestaurantMenuView | null> {
    return null;
  }
  async getMenuItemView(): Promise<MenuItemView | null> {
    return null;
  }
  async getItemsSnapshot(itemIds: string[]): Promise<MenuItemView[]> {
    return itemIds.map((id) => this.items[id]).filter((v): v is MenuItemView => v !== undefined);
  }
}

class FakeCatalogQueryRepository implements ICatalogQueryRepository {
  constructor(
    private readonly restaurants: Record<string, CatalogQueryRestaurant> = {},
    private readonly items: Record<string, CatalogQueryMenuItem> = {}
  ) {}

  async findRestaurantById(restaurantId: string): Promise<CatalogQueryRestaurant | null> {
    return this.restaurants[restaurantId] ?? null;
  }
  async findPublicRestaurantById(restaurantId: string): Promise<CatalogQueryRestaurant | null> {
    return this.restaurants[restaurantId] ?? null;
  }
  async findPublicRestaurantsByIds(restaurantIds: string[]): Promise<CatalogQueryRestaurant[]> {
    return restaurantIds
      .map((id) => this.restaurants[id])
      .filter((v): v is CatalogQueryRestaurant => v !== undefined);
  }
  async findMenuItemsByIds(menuItemIds: string[]): Promise<CatalogQueryMenuItem[]> {
    return menuItemIds
      .map((id) => this.items[id])
      .filter((v): v is CatalogQueryMenuItem => v !== undefined);
  }
  async findMenuItemsByRestaurant(restaurantId: string): Promise<CatalogQueryMenuItem[]> {
    return Object.values(this.items).filter((item) => item.restaurantId === restaurantId);
  }
}

class FakeServiceabilityQuery {
  constructor(private readonly views: ServiceableRestaurantView[] = []) {}
  async execute(_dto: CheckServiceabilityDto): Promise<Result<ServiceableRestaurantView[]>> {
    return Result.ok(this.views);
  }
}

class FakeOpeningHoursService {
  constructor(private readonly open: boolean = true) {}
  async isRestaurantOpen(_restaurantId: string, _at?: Date): Promise<boolean> {
    return this.open;
  }
}

const summary = (over: Partial<RestaurantSummaryView> = {}): RestaurantSummaryView => ({
  id: 'rest-1',
  name: 'Pizza Palace',
  slug: 'pizza-palace',
  cuisineTypes: [],
  status: RESTAURANT_STATUS.ACTIVE,
  isOpen: true,
  location: { lat: 12.9, lng: 77.6 },
  ...over,
});

const itemView = (over: Partial<MenuItemView> = {}): MenuItemView => ({
  id: 'item-1',
  restaurantId: 'rest-1',
  categoryId: 'cat-1',
  name: 'Margherita',
  basePriceAmount: 24900,
  currency: 'INR',
  tags: [],
  dietary: [],
  isAvailable: true,
  ...over,
});

const queryRestaurant = (over: Partial<CatalogQueryRestaurant> = {}): CatalogQueryRestaurant => ({
  id: 'rest-1',
  name: 'Pizza Palace',
  slug: 'pizza-palace',
  description: null,
  cuisineTypes: [],
  status: RESTAURANT_STATUS.ACTIVE,
  visibility: CATALOG_VISIBILITY.PUBLIC,
  imageUrl: null,
  location: { lat: 12.9, lng: 77.6 },
  openingHours: { schedule: { mon: [{ open: '09:00', close: '22:00' }] }, holidays: ['2026-01-01'] },
  categories: [{ id: 'cat-1', label: 'Pizzas', sortOrder: 0, isActive: true }],
  deliveryZones: [
    {
      id: 'zone-1',
      feeTiers: [{ maxDistanceMeters: 5000, fee: { amount: 4000, currency: 'INR' } }],
      freeAboveSubtotal: { amount: 100000, currency: 'INR' },
      minOrder: { amount: 20000, currency: 'INR' },
    },
  ],
  ...over,
});

const queryItem = (over: Partial<CatalogQueryMenuItem> = {}): CatalogQueryMenuItem => ({
  id: 'item-1',
  restaurantId: 'rest-1',
  categoryId: 'cat-1',
  name: 'Margherita',
  description: null,
  imageUrl: null,
  basePrice: { amount: 24900, currency: 'INR' },
  tags: [],
  dietary: [],
  isAvailable: true,
  outOfStockReason: null,
  variantGroups: [
    {
      id: 'grp-1',
      label: 'Size',
      selectionType: VARIANT_SELECTION_TYPE.SINGLE,
      required: true,
      minSelect: 1,
      maxSelect: 1,
      options: [
        {
          id: 'opt-1',
          label: 'Large',
          priceDelta: { amount: 5000, currency: 'INR' },
          isDefault: false,
          isAvailable: true,
        },
      ],
    },
  ],
  ...over,
});

const point = GeoPoint.create(12.9, 77.6).getValue();
const subtotal = Money.create(50000, 'INR').getValue();

describe('CatalogGateway (ACL adapter — contract over Catalog read shapes)', () => {
  describe('getRestaurantForCheckout', () => {
    it('maps a published restaurant summary to CheckoutRestaurant', async () => {
      const repo = new FakeCatalogReadRepository({ 'rest-1': summary({ status: RESTAURANT_STATUS.ACTIVE }) });
      const gateway = new CatalogGateway(
        repo,
        new FakeServiceabilityQuery(),
        new FakeOpeningHoursService(),
        new FakeCatalogQueryRepository()
      );

      const result = await gateway.getRestaurantForCheckout('rest-1');

      expect(result.isSuccess).toBe(true);
      const r = result.getValue();
      expect(r.restaurantId).toBe('rest-1');
      expect(r.name).toBe('Pizza Palace');
      expect(r.status).toBe(COMMERCE_RESTAURANT_STATUS.ACTIVE);
      expect(r.isOpen).toBe(true);
    });

    it('fails with NotFoundError when the restaurant is absent or non-PUBLIC', async () => {
      const repo = new FakeCatalogReadRepository();
      const gateway = new CatalogGateway(
        repo,
        new FakeServiceabilityQuery(),
        new FakeOpeningHoursService(),
        new FakeCatalogQueryRepository()
      );

      const result = await gateway.getRestaurantForCheckout('rest-1');

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFoundError);
    });
  });

  describe('getItemsSnapshot', () => {
    it('maps MenuItemView[] to CheckoutMenuItem[] with Money base price', async () => {
      const repo = new FakeCatalogReadRepository(
        {},
        { 'item-1': itemView({ basePriceAmount: 24900, currency: 'INR' }) }
      );
      const gateway = new CatalogGateway(
        repo,
        new FakeServiceabilityQuery(),
        new FakeOpeningHoursService(),
        new FakeCatalogQueryRepository()
      );

      const result = await gateway.getItemsSnapshot(['item-1']);

      expect(result.isSuccess).toBe(true);
      const items = result.getValue();
      expect(items).toHaveLength(1);
      expect(items[0].menuItemId).toBe('item-1');
      expect(items[0].restaurantId).toBe('rest-1');
      expect(items[0].categoryId).toBe('cat-1');
      expect(items[0].isAvailable).toBe(true);
      expect(items[0].basePrice.amount).toBe(24900);
      expect(items[0].basePrice.currency).toBe('INR');
    });

    it('omits items that no longer exist (absent from the published snapshot)', async () => {
      const repo = new FakeCatalogReadRepository({}, { 'item-1': itemView() });
      const gateway = new CatalogGateway(
        repo,
        new FakeServiceabilityQuery(),
        new FakeOpeningHoursService(),
        new FakeCatalogQueryRepository()
      );

      const result = await gateway.getItemsSnapshot(['item-1', 'missing']);

      expect(result.getValue().map((i) => i.menuItemId)).toEqual(['item-1']);
    });
  });

  describe('checkServiceability', () => {
    it('maps the matching ServiceableRestaurantView to a serviceable result', async () => {
      const views: ServiceableRestaurantView[] = [
        {
          restaurantId: 'rest-1',
          name: 'Pizza Palace',
          slug: 'pizza-palace',
          distanceMeters: 3200,
          deliveryFee: { amount: 4000, currency: 'INR' },
          minOrder: { amount: 20000, currency: 'INR' },
        },
      ];
      const gateway = new CatalogGateway(
        new FakeCatalogReadRepository(),
        new FakeServiceabilityQuery(views),
        new FakeOpeningHoursService(),
        new FakeCatalogQueryRepository()
      );

      const result = await gateway.checkServiceability('rest-1', point, subtotal);

      expect(result.isSuccess).toBe(true);
      const s = result.getValue();
      expect(s.serviceable).toBe(true);
      expect(s.distanceMeters).toBe(3200);
      expect(s.deliveryFee.amount).toBe(4000);
      expect(s.minOrder.amount).toBe(20000);
    });

    it('returns serviceable:false with zeroed money when the restaurant does not serve the point', async () => {
      const gateway = new CatalogGateway(
        new FakeCatalogReadRepository(),
        new FakeServiceabilityQuery([]),
        new FakeOpeningHoursService(),
        new FakeCatalogQueryRepository()
      );

      const result = await gateway.checkServiceability('rest-1', point, subtotal);

      expect(result.isSuccess).toBe(true);
      const s = result.getValue();
      expect(s.serviceable).toBe(false);
      expect(s.deliveryFee.amount).toBe(0);
      expect(s.deliveryFee.currency).toBe('INR');
      expect(s.minOrder.amount).toBe(0);
    });
  });

  describe('getRestaurantForCart', () => {
    const buildGateway = (queryRepo: FakeCatalogQueryRepository) =>
      new CatalogGateway(
        new FakeCatalogReadRepository(),
        new FakeServiceabilityQuery(),
        new FakeOpeningHoursService(),
        queryRepo
      );

    it('maps a restaurant to CartRestaurantView, carrying opening hours and per-zone min-order', async () => {
      const gateway = buildGateway(new FakeCatalogQueryRepository({ 'rest-1': queryRestaurant() }));

      const result = await gateway.getRestaurantForCart('rest-1');

      expect(result.isSuccess).toBe(true);
      const view = result.getValue();
      expect(view).not.toBeNull();
      expect(view!.restaurantId).toBe('rest-1');
      expect(view!.status).toBe(RESTAURANT_STATUS.ACTIVE);
      expect(view!.visibility).toBe(CATALOG_VISIBILITY.PUBLIC);
      expect(view!.openingHours).toEqual({
        schedule: { mon: [{ open: '09:00', close: '22:00' }] },
        holidays: ['2026-01-01'],
      });
      expect(view!.tzOffsetMinutes).toBe(0);
      expect(view!.deliveryZones).toEqual([
        {
          deliveryZoneId: 'zone-1',
          feeTiers: [{ maxDistanceMeters: 5000, feeAmount: 4000, currency: 'INR' }],
          freeAboveSubtotalAmount: 100000,
          minOrderAmount: 20000,
          currency: 'INR',
        },
      ]);
    });

    it('returns the raw status/visibility of an unpublished restaurant rather than failing', async () => {
      const gateway = buildGateway(
        new FakeCatalogQueryRepository({
          'rest-1': queryRestaurant({
            status: RESTAURANT_STATUS.PAUSED,
            visibility: CATALOG_VISIBILITY.HIDDEN,
          }),
        })
      );

      const result = await gateway.getRestaurantForCart('rest-1');

      expect(result.isSuccess).toBe(true);
      expect(result.getValue()!.status).toBe(RESTAURANT_STATUS.PAUSED);
      expect(result.getValue()!.visibility).toBe(CATALOG_VISIBILITY.HIDDEN);
    });

    it('resolves to null when the restaurant does not exist', async () => {
      const gateway = buildGateway(new FakeCatalogQueryRepository());

      const result = await gateway.getRestaurantForCart('rest-1');

      expect(result.isSuccess).toBe(true);
      expect(result.getValue()).toBeNull();
    });

    it('maps a restaurant with no opening hours to null', async () => {
      const gateway = buildGateway(
        new FakeCatalogQueryRepository({ 'rest-1': queryRestaurant({ openingHours: null }) })
      );

      const result = await gateway.getRestaurantForCart('rest-1');

      expect(result.getValue()!.openingHours).toBeNull();
    });
  });

  describe('getItemsForCart', () => {
    const buildGateway = (queryRepo: FakeCatalogQueryRepository) =>
      new CatalogGateway(
        new FakeCatalogReadRepository(),
        new FakeServiceabilityQuery(),
        new FakeOpeningHoursService(),
        queryRepo
      );

    it('maps items to CartMenuItemView including variant option groups', async () => {
      const gateway = buildGateway(new FakeCatalogQueryRepository({}, { 'item-1': queryItem() }));

      const result = await gateway.getItemsForCart(['item-1']);

      expect(result.isSuccess).toBe(true);
      const items = result.getValue();
      expect(items).toHaveLength(1);
      expect(items[0]).toEqual({
        menuItemId: 'item-1',
        restaurantId: 'rest-1',
        categoryId: 'cat-1',
        name: 'Margherita',
        basePriceAmount: 24900,
        currency: 'INR',
        isAvailable: true,
        outOfStockReason: null,
        variantGroups: [
          {
            groupId: 'grp-1',
            label: 'Size',
            selectionType: VARIANT_SELECTION_TYPE.SINGLE,
            required: true,
            minSelect: 1,
            maxSelect: 1,
            options: [
              {
                optionId: 'opt-1',
                label: 'Large',
                priceDeltaAmount: 5000,
                currency: 'INR',
                isDefault: false,
                isAvailable: true,
              },
            ],
          },
        ],
      });
    });

    it('reports item availability as the item flag plus its out-of-stock reason', async () => {
      const gateway = buildGateway(
        new FakeCatalogQueryRepository(
          {},
          { 'item-1': queryItem({ isAvailable: false, outOfStockReason: 'Sold out' }) }
        )
      );

      const items = (await gateway.getItemsForCart(['item-1'])).getValue();

      expect(items[0].isAvailable).toBe(false);
      expect(items[0].outOfStockReason).toBe('Sold out');
    });

    it('omits items that no longer exist', async () => {
      const gateway = buildGateway(new FakeCatalogQueryRepository({}, { 'item-1': queryItem() }));

      const items = (await gateway.getItemsForCart(['item-1', 'missing'])).getValue();

      expect(items.map((i) => i.menuItemId)).toEqual(['item-1']);
    });
  });

  describe('isRestaurantOpen', () => {
    it('delegates to IOpeningHoursService', async () => {
      const gateway = new CatalogGateway(
        new FakeCatalogReadRepository(),
        new FakeServiceabilityQuery(),
        new FakeOpeningHoursService(false),
        new FakeCatalogQueryRepository()
      );

      const result = await gateway.isRestaurantOpen('rest-1');

      expect(result.isSuccess).toBe(true);
      expect(result.getValue()).toBe(false);
    });
  });
});
