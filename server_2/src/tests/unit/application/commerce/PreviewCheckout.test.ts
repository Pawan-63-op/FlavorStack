import { PreviewCheckout } from '../../../../application/commerce/use-cases/PreviewCheckout';
import { CheckoutContextAssembler } from '../../../../application/commerce/services/CheckoutContextAssembler';
import { PricingCalculator } from '../../../../infrastructure/services/PricingCalculator';
import { PromotionService } from '../../../../infrastructure/services/PromotionService';
import { buildDefaultCommerceCoupons } from '../../../../infrastructure/services/CommerceCouponCatalog';
import { buildDefaultCommercePricingPolicy } from '../../../../infrastructure/services/CommercePricingConfig';
import { Cart } from '../../../../domain/commerce/entities/Cart';
import { LineItemSelection } from '../../../../domain/commerce/value-objects/LineItemSelection';
import { AppliedPromotion } from '../../../../domain/commerce/value-objects/AppliedPromotion';
import { PROMOTION_KIND } from '../../../../domain/commerce/enums/promotion-kind.enum';
import { COMMERCE_RESTAURANT_STATUS } from '../../../../domain/commerce/enums/restaurant-status.enum';
import { Money } from '../../../../domain/shared/Money';
import { Result } from '../../../../domain/shared/Result';
import { ICartRepository } from '../../../../domain/commerce/repositories/ICartRepository';
import { ICatalogGateway } from '../../../../domain/commerce/services/ICatalogGateway';
import {
  CheckoutRestaurant,
  CheckoutMenuItem,
  CheckoutServiceability,
} from '../../../../domain/commerce/types/CatalogGatewayRead';
import { CartMenuItemView } from '../../../../domain/commerce/types/CatalogGatewayRead';
import { makeAddressResolver } from '../../../mocks/commerce.mocks';
import { DeliveryAddressResolver } from '../../../../application/commerce/services/DeliveryAddressResolver';
import { Address } from '../../../../domain/identity/value-objects/Address.vo';
import { GeoPoint } from '../../../../domain/identity/value-objects/GeoPoint.vo';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';

const money = (amount: number, currency = 'INR') => Money.create(amount, currency).getValue();

function buildCart(): Cart {
  const cart = Cart.create('cust-1').getValue();
  const selection = LineItemSelection.create({
    menuItemId: 'menu-1',
    selectedOptionIds: ['opt-large'],
    quantity: 2,
  }).getValue();
  cart.addItem('rest-1', selection, money(1200)); // cached unit price; recomputed at checkout
  cart.pullDomainEvents();
  return cart;
}

const DELIVERY_POINT = { lat: 12.97, lng: 77.59 };


interface GatewayConfig {
  restaurant?: CheckoutRestaurant;
  items?: CheckoutMenuItem[];
  serviceability?: CheckoutServiceability;
  variants?: CartMenuItemView[];
}

function defaultRestaurant(): CheckoutRestaurant {
  return { restaurantId: 'rest-1', name: 'Pizza Place', status: COMMERCE_RESTAURANT_STATUS.ACTIVE, isOpen: true };
}

function defaultItems(): CheckoutMenuItem[] {
  return [
    {
      menuItemId: 'menu-1',
      restaurantId: 'rest-1',
      name: 'Margherita',
      categoryId: 'cat-1',
      basePrice: money(1000),
      isAvailable: true,
    },
  ];
}

function defaultServiceability(): CheckoutServiceability {
  return { serviceable: true, distanceMeters: 3000, deliveryFee: money(4000), minOrder: money(2000) };
}

function fakeGateway(cfg: GatewayConfig = {}): ICatalogGateway {
  return {
    getRestaurantForCheckout: async () => Result.ok(cfg.restaurant ?? defaultRestaurant()),
    getItemsSnapshot: async () => Result.ok(cfg.items ?? defaultItems()),
    checkServiceability: async () => Result.ok(cfg.serviceability ?? defaultServiceability()),
    isRestaurantOpen: async () => Result.ok(true),
    // Variant option groups for checkout option resolution.
    getRestaurantForCart: async () => Result.ok(null),
    getItemsForCart: async () => Result.ok(cfg.variants ?? [defaultVariantView()]),
  };
}

function defaultVariantView(): CartMenuItemView {
  return {
    menuItemId: 'menu-1',
    restaurantId: 'rest-1',
    categoryId: 'cat-1',
    name: 'Margherita',
    basePriceAmount: 1000,
    currency: 'INR',
    isAvailable: true,
    outOfStockReason: null,
    variantGroups: [
      {
        groupId: 'size',
        label: 'Size',
        selectionType: 'single',
        required: true,
        minSelect: 1,
        maxSelect: 1,
        options: [
          { optionId: 'opt-large', label: 'Large', priceDeltaAmount: 200, currency: 'INR', isDefault: false, isAvailable: true },
        ],
      },
    ],
  };
}

function fakeCartRepo(cart: Cart | null): ICartRepository {
  return {
    findById: async () => cart,
    findByCustomerId: async () => cart,
    save: async () => undefined,
    delete: async () => undefined,
  };
}

function buildUseCase(opts: {
  cart?: Cart | null;
  gateway?: ICatalogGateway;
  promotionService?: PromotionService;
  addressResolver?: DeliveryAddressResolver;
} = {}): PreviewCheckout {
  const promotionService = opts.promotionService ?? new PromotionService(buildDefaultCommerceCoupons());
  const assembler = new CheckoutContextAssembler(
    opts.gateway ?? fakeGateway(),
    promotionService,
    buildDefaultCommercePricingPolicy()
  );
  return new PreviewCheckout(
    fakeCartRepo(opts.cart === undefined ? buildCart() : opts.cart),
    assembler,
    opts.addressResolver ?? makeAddressResolver().resolver,
    new PricingCalculator()
  );
}


describe('PreviewCheckout', () => {
  describe('happy path', () => {
    it('prices the cart authoritatively without persisting', async () => {
      const result = await buildUseCase().execute({ customerId: 'cust-1', deliveryPoint: DELIVERY_POINT });

      expect(result.isSuccess).toBe(true);
      const view = result.getValue();

      expect(view.restaurantId).toBe('rest-1');
      expect(view.serviceable).toBe(true);
      expect(view.distanceMeters).toBe(3000);
      expect(view.deliveryFee).toEqual({ amount: 4000, currency: 'INR' });
      expect(view.minOrder).toEqual({ amount: 2000, currency: 'INR' });
      expect(view.promotion).toBeNull();

      expect(view.lines).toHaveLength(1);
      expect(view.lines[0].unitPrice).toEqual({ amount: 1200, currency: 'INR' });
      expect(view.lines[0].lineTotal).toEqual({ amount: 2400, currency: 'INR' });
      expect(view.lines[0].selectedOptions[0]).toEqual({
        optionId: 'opt-large',
        label: 'Large',
        priceDelta: { amount: 200, currency: 'INR' },
      });

      expect(view.pricing.subtotal.amount).toBe(2400);
      expect(view.pricing.fees.map((f) => [f.type, f.amount.amount])).toEqual([
        ['PLATFORM', 500],
        ['PACKAGING', 300],
        ['DELIVERY', 4000],
      ]);
      expect(view.pricing.discount.amount).toBe(0);
      expect(view.pricing.tax.amount).toBe(360);
      expect(view.pricing.total.amount).toBe(7560);
    });
  });

  describe('promotion re-validation', () => {
    it('reflects a re-validated promotion discount in the breakdown', async () => {
      const cart = buildCart();
      cart.applyPromotion(
        AppliedPromotion.create({
          code: 'SAVE10',
          kind: PROMOTION_KIND.PERCENTAGE,
          discount: money(1), // stale value; recomputed by the engine
          sourceRef: 'coupon:SAVE10',
        }).getValue()
      );
      cart.pullDomainEvents();

      const view = (await buildUseCase({ cart }).execute({ customerId: 'cust-1', deliveryPoint: DELIVERY_POINT })).getValue();

      expect(view.promotion).toEqual({ code: 'SAVE10', discount: { amount: 240, currency: 'INR' } });
      expect(view.pricing.discount.amount).toBe(240);
      expect(view.pricing.tax.amount).toBe(348);
      expect(view.pricing.total.amount).toBe(7308);
    });

    it('fails when an applied promotion no longer qualifies at the fresh subtotal', async () => {
      const cart = buildCart();
      cart.applyPromotion(
        AppliedPromotion.create({
          code: 'FLAT50',
          kind: PROMOTION_KIND.FIXED,
          discount: money(5000),
          sourceRef: 'coupon:FLAT50',
        }).getValue()
      );
      cart.pullDomainEvents();

      const result = await buildUseCase({ cart }).execute({ customerId: 'cust-1', deliveryPoint: DELIVERY_POINT });
      expect(result.isFailure).toBe(true);
    });
  });

  describe('guards', () => {
    it('fails when the customer has no cart', async () => {
      const result = await buildUseCase({ cart: null }).execute({ customerId: 'cust-1', deliveryPoint: DELIVERY_POINT });
      expect(result.isFailure).toBe(true);
    });

    it('fails when the restaurant is not active', async () => {
      const gateway = fakeGateway({
        restaurant: { restaurantId: 'rest-1', name: 'x', status: COMMERCE_RESTAURANT_STATUS.PAUSED, isOpen: true },
      });
      const result = await buildUseCase({ gateway }).execute({ customerId: 'cust-1', deliveryPoint: DELIVERY_POINT });
      expect(result.isFailure).toBe(true);
    });

    it('fails when the restaurant is closed', async () => {
      const gateway = fakeGateway({
        restaurant: { restaurantId: 'rest-1', name: 'x', status: COMMERCE_RESTAURANT_STATUS.ACTIVE, isOpen: false },
      });
      const result = await buildUseCase({ gateway }).execute({ customerId: 'cust-1', deliveryPoint: DELIVERY_POINT });
      expect(result.isFailure).toBe(true);
    });

    it('fails when an item is unavailable', async () => {
      const items = defaultItems();
      items[0].isAvailable = false;
      const result = await buildUseCase({ gateway: fakeGateway({ items }) }).execute({
        customerId: 'cust-1',
        deliveryPoint: DELIVERY_POINT,
      });
      expect(result.isFailure).toBe(true);
    });

    it('fails when the address is not serviceable', async () => {
      const gateway = fakeGateway({
        serviceability: { serviceable: false, distanceMeters: 0, deliveryFee: money(0), minOrder: money(0) },
      });
      const result = await buildUseCase({ gateway }).execute({ customerId: 'cust-1', deliveryPoint: DELIVERY_POINT });
      expect(result.isFailure).toBe(true);
    });

    it('fails when the subtotal is below the minimum order', async () => {
      const gateway = fakeGateway({
        serviceability: { serviceable: true, distanceMeters: 3000, deliveryFee: money(4000), minOrder: money(999999) },
      });
      const result = await buildUseCase({ gateway }).execute({ customerId: 'cust-1', deliveryPoint: DELIVERY_POINT });
      expect(result.isFailure).toBe(true);
    });

    it('fails when a selected variant option is unavailable', async () => {
      const view = defaultVariantView();
      view.variantGroups[0].options[0].isAvailable = false;
      const result = await buildUseCase({ gateway: fakeGateway({ variants: [view] }) }).execute({
        customerId: 'cust-1',
        deliveryPoint: DELIVERY_POINT,
      });
      expect(result.isFailure).toBe(true);
    });
  });

  // Phase 10.3: preview and checkout resolve the delivery point the same way, so the fee
  // shown here is the fee `Checkout` will charge.
  describe('delivery address resolution', () => {
    const savedAddress = (lat: number, lng: number) =>
      Address.create({
        street: '42 Residency Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        pinCode: '560025',
        coordinates: GeoPoint.create(lat, lng).getValue(),
      }).getValue();

    it('prices from the saved address when addressId is given', async () => {
      const { resolver } = makeAddressResolver([
        {
          customerId: 'cust-1',
          addressId: 'addr-1',
          address: savedAddress(DELIVERY_POINT.lat, DELIVERY_POINT.lng),
        },
      ]);

      const fromId = await buildUseCase({ addressResolver: resolver }).execute({
        customerId: 'cust-1',
        addressId: 'addr-1',
      });
      const fromPoint = await buildUseCase().execute({
        customerId: 'cust-1',
        deliveryPoint: DELIVERY_POINT,
      });

      expect(fromId.isSuccess).toBe(true);
      expect(fromId.getValue().pricing).toEqual(fromPoint.getValue().pricing);
    });

    it("fails with NotFoundError for another customer's addressId", async () => {
      const { resolver } = makeAddressResolver([
        { customerId: 'someone-else', addressId: 'addr-1', address: savedAddress(12.97, 77.59) },
      ]);

      const result = await buildUseCase({ addressResolver: resolver }).execute({
        customerId: 'cust-1',
        addressId: 'addr-1',
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFoundError);
    });

    it('fails when neither addressId nor deliveryPoint is supplied', async () => {
      const result = await buildUseCase().execute({ customerId: 'cust-1' });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });
  });
});
