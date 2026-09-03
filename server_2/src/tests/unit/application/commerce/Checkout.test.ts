import { Checkout } from '../../../../application/commerce/use-cases/Checkout';
import { CheckoutContextAssembler } from '../../../../application/commerce/services/CheckoutContextAssembler';
import { PricingCalculator } from '../../../../infrastructure/services/PricingCalculator';
import { PromotionService } from '../../../../infrastructure/services/PromotionService';
import { buildDefaultCommerceCoupons } from '../../../../infrastructure/services/CommerceCouponCatalog';
import { buildDefaultCommercePricingPolicy } from '../../../../infrastructure/services/CommercePricingConfig';
import { Cart } from '../../../../domain/commerce/entities/Cart';
import { LineItemSelection } from '../../../../domain/commerce/value-objects/LineItemSelection';
import { AppliedPromotion } from '../../../../domain/commerce/value-objects/AppliedPromotion';
import { OrderRequest } from '../../../../domain/commerce/entities/OrderRequest';
import { IdempotencyKey } from '../../../../domain/commerce/value-objects/IdempotencyKey';
import { PROMOTION_KIND } from '../../../../domain/commerce/enums/promotion-kind.enum';
import { PAYMENT_METHOD } from '../../../../domain/commerce/enums/payment-method.enum';
import { COMMERCE_RESTAURANT_STATUS } from '../../../../domain/commerce/enums/restaurant-status.enum';
import { ORDER_REQUEST_STATUS } from '../../../../domain/commerce/enums/order-request-status.enum';
import { Money } from '../../../../domain/shared/Money';
import { Result } from '../../../../domain/shared/Result';
import { DomainEvent } from '../../../../domain/shared/DomainEvent';
import { ICartRepository } from '../../../../domain/commerce/repositories/ICartRepository';
import { IOrderRequestRepository } from '../../../../domain/commerce/repositories/IOrderRequestRepository';
import { ICatalogGateway } from '../../../../domain/commerce/services/ICatalogGateway';
import { IUnitOfWork } from '../../../../application/shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../../../application/shared/outbox/IOutboxStore';
import { IEventBus } from '../../../../application/shared/events/IEventBus';
import { ITelemetry, ISpan, LogFields } from '../../../../application/shared/observability/ITelemetry';
import {
  CommerceTelemetry,
  COMMERCE_METRICS,
} from '../../../../application/commerce/observability/CommerceTelemetry';
import {
  CheckoutRestaurant,
  CheckoutMenuItem,
  CheckoutServiceability,
} from '../../../../domain/commerce/types/CatalogGatewayRead';
import { CartMenuItemView } from '../../../../domain/commerce/types/CatalogGatewayRead';
import { CheckoutRequestDto } from '../../../../application/commerce/dtos/CheckoutRequestDto';
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
  cart.addItem('rest-1', selection, money(1200));
  cart.pullDomainEvents();
  return cart;
}

const ADDRESS: CheckoutRequestDto['deliveryAddress'] = {
  label: 'Home',
  street: '1 MG Road',
  city: 'Bengaluru',
  state: 'Karnataka',
  pinCode: '560001',
  coordinates: { lat: 12.97, lng: 77.59 },
};

function dto(overrides: Partial<CheckoutRequestDto> = {}): CheckoutRequestDto {
  return {
    customerId: 'cust-1',
    idempotencyKey: '11111111-1111-1111-1111-111111111111',
    paymentMethod: PAYMENT_METHOD.UPI,
    deliveryAddress: ADDRESS,
    ...overrides,
  };
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

interface GatewayConfig {
  restaurant?: CheckoutRestaurant;
  items?: CheckoutMenuItem[];
  serviceability?: CheckoutServiceability;
  variants?: CartMenuItemView[];
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

function fakeCartRepo(cart: Cart | null): { repo: ICartRepository; saved: Cart[] } {
  const saved: Cart[] = [];
  return {
    saved,
    repo: {
      findById: async () => cart,
      findByCustomerId: async () => cart,
      save: async (c: Cart) => {
        saved.push(c);
      },
      delete: async () => undefined,
    },
  };
}

function fakeOrderRepo(existing: OrderRequest | null = null): { repo: IOrderRequestRepository; saved: OrderRequest[] } {
  const saved: OrderRequest[] = [];
  return {
    saved,
    repo: {
      findById: async () => null,
      findByIdempotencyKey: async () => existing,
      save: async (order: OrderRequest) => {
        saved.push(order);
      },
    },
  };
}

function fakeUnitOfWork(): IUnitOfWork {
  return {
    runInTransaction: async (work) => work({ session: 'fake' }),
  };
}

function fakeOutbox(): { store: IOutboxStore; appended: DomainEvent[] } {
  const appended: DomainEvent[] = [];
  return {
    appended,
    store: {
      append: async (events: DomainEvent[]) => {
        appended.push(...events);
      },
    },
  };
}

function fakeEventBus(): { bus: IEventBus; published: DomainEvent[] } {
  const published: DomainEvent[] = [];
  return {
    published,
    bus: {
      subscribe: () => undefined,
      publish: async (e: DomainEvent) => {
        published.push(e);
      },
      publishAll: async (events: DomainEvent[]) => {
        published.push(...events);
      },
    },
  };
}

/** A spyable ITelemetry so the metric names Checkout emits are assertable by name. */
function fakeTelemetry(): jest.Mocked<ITelemetry> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    increment: jest.fn(),
    observe: jest.fn(),
    startSpan: jest.fn((_name: string, _fields?: LogFields): ISpan => ({
      end: () => 0,
      fail: () => 0,
    })),
  };
}

interface Harness {
  useCase: Checkout;
  orderRepo: ReturnType<typeof fakeOrderRepo>;
  cartRepo: ReturnType<typeof fakeCartRepo>;
  outbox: ReturnType<typeof fakeOutbox>;
  eventBus: ReturnType<typeof fakeEventBus>;
  telemetry: jest.Mocked<ITelemetry>;
}

function buildHarness(opts: {
  cart?: Cart | null;
  existingOrder?: OrderRequest | null;
  gateway?: ICatalogGateway;
  promotionService?: PromotionService;
  addressResolver?: DeliveryAddressResolver;
} = {}): Harness {
  const promotionService = opts.promotionService ?? new PromotionService(buildDefaultCommerceCoupons());
  const assembler = new CheckoutContextAssembler(
    opts.gateway ?? fakeGateway(),
    promotionService,
    buildDefaultCommercePricingPolicy()
  );
  const cartRepo = fakeCartRepo(opts.cart === undefined ? buildCart() : opts.cart);
  const orderRepo = fakeOrderRepo(opts.existingOrder ?? null);
  const outbox = fakeOutbox();
  const eventBus = fakeEventBus();
  const telemetry = fakeTelemetry();
  const useCase = new Checkout(
    cartRepo.repo,
    orderRepo.repo,
    assembler,
    opts.addressResolver ?? makeAddressResolver().resolver,
    new PricingCalculator(),
    fakeUnitOfWork(),
    outbox.store,
    new CommerceTelemetry(telemetry)
  );
  return { useCase, orderRepo, cartRepo, outbox, eventBus, telemetry };
}


describe('Checkout', () => {
  describe('happy path', () => {
    it('persists an OrderRequest, appends outbox events, and returns the summary', async () => {
      const h = buildHarness();
      const result = await h.useCase.execute(dto());

      expect(result.isSuccess).toBe(true);
      const summary = result.getValue();

      expect(summary.restaurantId).toBe('rest-1');
      expect(summary.restaurantName).toBe('Pizza Place');
      expect(summary.status).toBe(ORDER_REQUEST_STATUS.REQUESTED);
      expect(summary.paymentMethod).toBe(PAYMENT_METHOD.UPI);
      expect(summary.idempotencyKey).toBe('11111111-1111-1111-1111-111111111111');

      expect(summary.lines).toHaveLength(1);
      expect(summary.lines[0].lineTotal).toEqual({ amount: 2400, currency: 'INR' });
      expect(summary.lines[0].selectedOptions[0]).toEqual({
        optionId: 'opt-large',
        label: 'Large',
        priceDelta: { amount: 200, currency: 'INR' },
      });

      expect(summary.pricing.subtotal).toEqual({ amount: 2400, currency: 'INR' });
      expect(summary.pricing.fees.map((f) => [f.type, f.amount.amount])).toEqual([
        ['PLATFORM', 500],
        ['PACKAGING', 300],
        ['DELIVERY', 4000],
      ]);
      expect(summary.pricing.tax).toEqual({ amount: 360, currency: 'INR' });
      expect(summary.pricing.total).toEqual({ amount: 7560, currency: 'INR' });

      expect(summary.deliveryAddress.pinCode).toBe('560001');

      expect(h.orderRepo.saved).toHaveLength(1);
      const saved = h.orderRepo.saved[0];
      expect(saved.id.toString()).toBe(summary.orderRequestId);

      // Phase 6: `OrderRequested` is the only event checkout raises. `CheckoutReadyForPayment`
      // had no subscriber — it was appended, relayed and dropped.
      expect(h.outbox.appended.map((e) => e.eventName)).toEqual(['OrderRequested']);
      // Phase 7.3: the outbox row is the ONLY delivery path — checkout no longer publishes inline.
      expect(h.eventBus.published).toHaveLength(0);
    });

    it('counts the outbox handoff exactly once, separately from checkout acceptance', async () => {
      const h = buildHarness();

      await h.useCase.execute(dto());

      // "Orders accepted" and "orders handed to the relay" must be independently countable —
      // the two diverging is the failure the outbox exists to make visible.
      const appends = h.telemetry.increment.mock.calls.filter(
        ([name]) => name === COMMERCE_METRICS.outboxAppendTotal
      );
      expect(appends).toHaveLength(1);
      expect(appends[0][2]).toBe(h.outbox.appended.length);
      expect(h.telemetry.increment).toHaveBeenCalledWith(COMMERCE_METRICS.checkoutTotal, {
        result: 'success',
      });
    });

    it('clears the cart after a successful checkout', async () => {
      const h = buildHarness();
      await h.useCase.execute(dto());

      expect(h.cartRepo.saved).toHaveLength(1);
      expect(h.cartRepo.saved[0].isEmpty).toBe(true);
    });

    it('mints an idempotency key when none is supplied', async () => {
      const h = buildHarness();
      const result = await h.useCase.execute(dto({ idempotencyKey: undefined }));
      expect(result.isSuccess).toBe(true);
      expect(result.getValue().idempotencyKey).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });
  });

  describe('idempotent replay', () => {
    it('returns the original OrderRequest without persisting or publishing again', async () => {
      const existing = buildExistingOrder();
      const h = buildHarness({ existingOrder: existing });

      const result = await h.useCase.execute(dto({ idempotencyKey: existing.idempotencyKey.value }));

      expect(result.isSuccess).toBe(true);
      expect(result.getValue().orderRequestId).toBe(existing.id.toString());
      expect(h.orderRepo.saved).toHaveLength(0);
      expect(h.outbox.appended).toHaveLength(0);
      expect(h.eventBus.published).toHaveLength(0);
    });

    it('does not count an outbox handoff on the replay path', async () => {
      const existing = buildExistingOrder();
      const h = buildHarness({ existingOrder: existing });

      await h.useCase.execute(dto({ idempotencyKey: existing.idempotencyKey.value }));

      expect(h.telemetry.increment).not.toHaveBeenCalledWith(
        COMMERCE_METRICS.outboxAppendTotal,
        expect.anything(),
        expect.anything()
      );
      expect(h.telemetry.increment).toHaveBeenCalledWith(
        COMMERCE_METRICS.checkoutIdempotentReplayTotal
      );
    });
  });

  describe('promotion re-validation', () => {
    it('commits a re-validated promotion discount', async () => {
      const cart = buildCart();
      cart.applyPromotion(
        AppliedPromotion.create({
          code: 'SAVE10',
          kind: PROMOTION_KIND.PERCENTAGE,
          discount: money(1),
          sourceRef: 'coupon:SAVE10',
        }).getValue()
      );
      cart.pullDomainEvents();

      const h = buildHarness({ cart });
      const summary = (await h.useCase.execute(dto())).getValue();

      expect(summary.pricing.discount).toEqual({ amount: 240, currency: 'INR' });
      expect(summary.pricing.total).toEqual({ amount: 7308, currency: 'INR' });
    });
  });

  describe('guards', () => {
    it('fails when the customer has no cart', async () => {
      const h = buildHarness({ cart: null });
      const result = await h.useCase.execute(dto());
      expect(result.isFailure).toBe(true);
      expect(h.orderRepo.saved).toHaveLength(0);
    });

    it('fails on an invalid idempotency key', async () => {
      const h = buildHarness();
      const result = await h.useCase.execute(dto({ idempotencyKey: 'not-a-uuid' }));
      expect(result.isFailure).toBe(true);
    });

    it('fails when the restaurant is closed (no order persisted)', async () => {
      const gateway = fakeGateway({
        restaurant: { restaurantId: 'rest-1', name: 'x', status: COMMERCE_RESTAURANT_STATUS.ACTIVE, isOpen: false },
      });
      const h = buildHarness({ gateway });
      const result = await h.useCase.execute(dto());
      expect(result.isFailure).toBe(true);
      expect(h.orderRepo.saved).toHaveLength(0);
      expect(h.outbox.appended).toHaveLength(0);
    });

    it('fails when the subtotal is below the minimum order', async () => {
      const gateway = fakeGateway({
        serviceability: { serviceable: true, distanceMeters: 3000, deliveryFee: money(4000), minOrder: money(999999) },
      });
      const h = buildHarness({ gateway });
      const result = await h.useCase.execute(dto());
      expect(result.isFailure).toBe(true);
    });
  });
});

// Phase 10.3: the delivery fee is computed from the delivery coordinates, so a
// client-supplied address lets the caller understate the distance. `addressId` resolves the
// address from the customer's own saved address book instead.
describe('Checkout — delivery address resolution', () => {
  const SAVED_ADDRESS = Address.create({
    label: 'Work',
    street: '42 Residency Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    pinCode: '560025',
    coordinates: GeoPoint.create(12.97, 77.59).getValue(),
  }).getValue();

  it("resolves the delivery address from the customer's saved addresses when addressId is given", async () => {
    const { resolver } = makeAddressResolver([
      { customerId: 'cust-1', addressId: 'addr-1', address: SAVED_ADDRESS },
    ]);
    const h = buildHarness({ addressResolver: resolver });

    const result = await h.useCase.execute(dto({ addressId: 'addr-1', deliveryAddress: undefined }));

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().deliveryAddress.pinCode).toBe('560025');
    expect(result.getValue().deliveryAddress.street).toBe('42 Residency Road');
  });

  it('ignores a client-supplied address when addressId is also present', async () => {
    const { resolver } = makeAddressResolver([
      { customerId: 'cust-1', addressId: 'addr-1', address: SAVED_ADDRESS },
    ]);
    const h = buildHarness({ addressResolver: resolver });

    const result = await h.useCase.execute(dto({ addressId: 'addr-1' }));

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().deliveryAddress.pinCode).toBe('560025');
  });

  it('fails with NotFoundError when the addressId belongs to another customer', async () => {
    const { resolver } = makeAddressResolver([
      { customerId: 'someone-else', addressId: 'addr-1', address: SAVED_ADDRESS },
    ]);
    const h = buildHarness({ addressResolver: resolver });

    const result = await h.useCase.execute(dto({ addressId: 'addr-1', deliveryAddress: undefined }));

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
    expect(h.orderRepo.saved).toHaveLength(0);
  });

  it('fails when neither addressId nor an inline address is supplied', async () => {
    const h = buildHarness();

    const result = await h.useCase.execute(dto({ deliveryAddress: undefined }));

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });
});

function buildExistingOrder(): OrderRequest {
  const { buildOrderRequest } = require('../../../integration/commerce/commerce-fixtures');
  return buildOrderRequest('cust-1', {
    idempotencyKey: IdempotencyKey.create('22222222-2222-2222-2222-222222222222').getValue(),
  });
}
