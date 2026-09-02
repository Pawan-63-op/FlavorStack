import { GetCart } from '../../../../application/commerce/use-cases/GetCart';
import { InMemoryCartRepository } from '../../../mocks/commerce.mocks';
import { Cart } from '../../../../domain/commerce/entities/Cart';
import { LineItemSelection } from '../../../../domain/commerce/value-objects/LineItemSelection';
import { Money } from '../../../../domain/shared/Money';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';
import { Result } from '../../../../domain/shared/Result';
import { CartValidator } from '../../../../infrastructure/services/CartValidator';
import { ICatalogGateway } from '../../../../domain/commerce/services/ICatalogGateway';
import { ICartValidator } from '../../../../domain/commerce/services/ICartValidator';
import { CartCatalogView } from '../../../../domain/commerce/types/CatalogGatewayRead';
import { VALIDATION_ISSUE_CODE, ValidationReport } from '../../../../domain/commerce/types/ValidationReport';
import { COMMERCE_RESTAURANT_STATUS } from '../../../../domain/commerce/enums/restaurant-status.enum';
import { COMMERCE_CATALOG_VISIBILITY } from '../../../../domain/commerce/enums/catalog-visibility.enum';

/** Splits a cart view back into the two gateway reads GetCart assembles it from. */
function makeCatalogGateway(view: CartCatalogView | null = null): ICatalogGateway {
  const restaurant = view ? { ...view, items: undefined } : null;
  if (restaurant) delete (restaurant as { items?: unknown }).items;

  return {
    getRestaurantForCart: jest.fn().mockResolvedValue(Result.ok(restaurant)),
    getItemsForCart: jest.fn(async (menuItemIds: string[]) =>
      Result.ok((view?.items ?? []).filter((item) => menuItemIds.includes(item.menuItemId)))
    ),
    getRestaurantForCheckout: jest.fn(),
    getItemsSnapshot: jest.fn(),
    checkServiceability: jest.fn(),
    isRestaurantOpen: jest.fn(),
  } as unknown as ICatalogGateway;
}

function buildRestaurantView(overrides: Partial<CartCatalogView> = {}): CartCatalogView {
  return {
    restaurantId: 'restaurant-1',
    name: 'Test Restaurant',
    slug: 'test-restaurant',
    status: COMMERCE_RESTAURANT_STATUS.ACTIVE,
    visibility: COMMERCE_CATALOG_VISIBILITY.PUBLIC,
    openingHours: null,
    tzOffsetMinutes: 0,
    deliveryZones: [],
    items: [
      {
        menuItemId: 'menu-1',
        restaurantId: 'restaurant-1',
        categoryId: 'cat-1',
        name: 'Burger',
        basePriceAmount: 15000,
        currency: 'INR',
        variantGroups: [],
        isAvailable: true,
        outOfStockReason: null,
      },
    ],
    ...overrides,
  };
}

describe('GetCart use-case', () => {
  let cartRepo: InMemoryCartRepository;

  beforeEach(() => {
    cartRepo = new InMemoryCartRepository();
  });

  it('returns the customer active cart as a CartView with a valid report', async () => {
    const cart = Cart.create('customer-1').getValue();
    const selection = LineItemSelection.create({ menuItemId: 'menu-1', quantity: 2 }).getValue();
    cart.addItem('restaurant-1', selection, Money.create(15000).getValue());
    await cartRepo.save(cart);

    const catalogGateway = makeCatalogGateway(buildRestaurantView());
    const useCase = new GetCart(cartRepo, catalogGateway, new CartValidator());

    const result = await useCase.execute({ customerId: 'customer-1' });

    expect(result.isSuccess).toBe(true);
    const view = result.getValue();
    expect(view.customerId).toBe('customer-1');
    expect(view.restaurantId).toBe('restaurant-1');
    expect(view.items).toHaveLength(1);
    expect(view.items[0].menuItemId).toBe('menu-1');
    expect(view.items[0].quantity).toBe(2);
    expect(view.items[0].unitPriceSnapshot).toEqual({ amount: 15000, currency: 'INR' });
    expect(view.items[0].lineTotal).toEqual({ amount: 30000, currency: 'INR' });
    expect(view.validation).toEqual({ isValid: true, issues: [] });
    expect(catalogGateway.getRestaurantForCart).toHaveBeenCalledWith('restaurant-1');
  });

  it('enriches each cart line with current name, price and availability from the projection', async () => {
    const cart = Cart.create('customer-1').getValue();
    const selection = LineItemSelection.create({ menuItemId: 'menu-1', quantity: 2 }).getValue();
    cart.addItem('restaurant-1', selection, Money.create(15000).getValue());
    await cartRepo.save(cart);

    const catalogGateway = makeCatalogGateway(buildRestaurantView());
    const useCase = new GetCart(cartRepo, catalogGateway, new CartValidator());

    const result = await useCase.execute({ customerId: 'customer-1' });

    expect(result.isSuccess).toBe(true);
    const view = result.getValue();
    expect(view.items[0].enrichment).toEqual({
      name: 'Burger',
      currentUnitPrice: { amount: 15000, currency: 'INR' },
      isAvailable: true,
    });
  });

  it('computes current unit price from base price plus selected variant deltas', async () => {
    const cart = Cart.create('customer-1').getValue();
    const selection = LineItemSelection.create({
      menuItemId: 'menu-1',
      quantity: 1,
      selectedOptionIds: ['opt-large'],
    }).getValue();
    cart.addItem('restaurant-1', selection, Money.create(17000).getValue());
    await cartRepo.save(cart);

    const view = buildRestaurantView({
      items: [
        {
          menuItemId: 'menu-1',
          restaurantId: 'restaurant-1',
          categoryId: 'cat-1',
          name: 'Burger',
          basePriceAmount: 15000,
          currency: 'INR',
          variantGroups: [
            {
              groupId: 'grp-size',
              label: 'Size',
              selectionType: 'SINGLE',
              required: true,
              minSelect: 1,
              maxSelect: 1,
              options: [
                {
                  optionId: 'opt-large',
                  label: 'Large',
                  priceDeltaAmount: 2000,
                  currency: 'INR',
                  isDefault: false,
                  isAvailable: true,
                },
              ],
            },
          ],
          isAvailable: true,
          outOfStockReason: null,
        },
      ],
    });
    const catalogGateway = makeCatalogGateway(view);
    const useCase = new GetCart(cartRepo, catalogGateway, new CartValidator());

    const result = await useCase.execute({ customerId: 'customer-1' });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().items[0].enrichment).toEqual({
      name: 'Burger',
      currentUnitPrice: { amount: 17000, currency: 'INR' },
      isAvailable: true,
    });
  });

  it('marks a line unavailable with null name/price when the item is missing from the projection', async () => {
    const cart = Cart.create('customer-1').getValue();
    const selection = LineItemSelection.create({ menuItemId: 'menu-gone', quantity: 1 }).getValue();
    cart.addItem('restaurant-1', selection, Money.create(15000).getValue());
    await cartRepo.save(cart);

    const catalogGateway = makeCatalogGateway(buildRestaurantView());
    const useCase = new GetCart(cartRepo, catalogGateway, new CartValidator());

    const result = await useCase.execute({ customerId: 'customer-1' });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().items[0].enrichment).toEqual({
      name: null,
      currentUnitPrice: null,
      isAvailable: false,
    });
  });

  it('fails with NotFoundError when the customer has no cart', async () => {
    const catalogGateway = makeCatalogGateway();
    const useCase = new GetCart(cartRepo, catalogGateway, new CartValidator());

    const result = await useCase.execute({ customerId: 'no-cart-customer' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
  });

  it('returns a trivially valid report for an empty cart without querying the catalog projection', async () => {
    const cart = Cart.create('customer-1').getValue();
    await cartRepo.save(cart);

    const catalogGateway = makeCatalogGateway();
    const useCase = new GetCart(cartRepo, catalogGateway, new CartValidator());

    const result = await useCase.execute({ customerId: 'customer-1' });

    expect(result.isSuccess).toBe(true);
    const view = result.getValue();
    expect(view.validation).toEqual({ isValid: true, issues: [] });
    expect(catalogGateway.getRestaurantForCart).not.toHaveBeenCalled();
  });

  it('surfaces validation issues from the catalog projection (e.g. unavailable item)', async () => {
    const cart = Cart.create('customer-1').getValue();
    const selection = LineItemSelection.create({ menuItemId: 'menu-1', quantity: 1 }).getValue();
    cart.addItem('restaurant-1', selection, Money.create(15000).getValue());
    await cartRepo.save(cart);

    const view = buildRestaurantView({
      items: [
        {
          menuItemId: 'menu-1',
          restaurantId: 'restaurant-1',
          categoryId: 'cat-1',
          name: 'Burger',
          basePriceAmount: 15000,
          currency: 'INR',
          variantGroups: [],
          isAvailable: false,
          outOfStockReason: 'sold_out',
        },
      ],
    });
    const catalogGateway = makeCatalogGateway(view);
    const useCase = new GetCart(cartRepo, catalogGateway, new CartValidator());

    const result = await useCase.execute({ customerId: 'customer-1' });

    expect(result.isSuccess).toBe(true);
    const responseView = result.getValue();
    expect(responseView.validation!.isValid).toBe(false);
    expect(responseView.validation!.issues).toContainEqual(
      expect.objectContaining({ code: VALIDATION_ISSUE_CODE.ITEM_UNAVAILABLE, menuItemId: 'menu-1' })
    );
  });

  it('propagates a failure result from the cart validator', async () => {
    const cart = Cart.create('customer-1').getValue();
    const selection = LineItemSelection.create({ menuItemId: 'menu-1', quantity: 1 }).getValue();
    cart.addItem('restaurant-1', selection, Money.create(15000).getValue());
    await cartRepo.save(cart);

    const catalogGateway = makeCatalogGateway(buildRestaurantView());
    const failingValidator: ICartValidator = {
      validate: jest.fn().mockReturnValue(Result.fail<ValidationReport>(new ValidationError('validator_exploded'))),
    };
    const useCase = new GetCart(cartRepo, catalogGateway, failingValidator);

    const result = await useCase.execute({ customerId: 'customer-1' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });
});
