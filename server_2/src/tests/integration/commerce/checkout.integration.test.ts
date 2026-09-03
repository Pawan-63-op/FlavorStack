import { randomUUID } from 'crypto';

import { Checkout } from '../../../application/commerce/use-cases/Checkout';
import { CheckoutContextAssembler } from '../../../application/commerce/services/CheckoutContextAssembler';
import { CheckoutRequestDto } from '../../../application/commerce/dtos/CheckoutRequestDto';
import { PricingCalculator } from '../../../infrastructure/services/PricingCalculator';
import { PromotionService } from '../../../infrastructure/services/PromotionService';
import { buildDefaultCommerceCoupons } from '../../../infrastructure/services/CommerceCouponCatalog';
import { buildDefaultCommercePricingPolicy } from '../../../infrastructure/services/CommercePricingConfig';

import { Cart } from '../../../domain/commerce/entities/Cart';
import { LineItemSelection } from '../../../domain/commerce/value-objects/LineItemSelection';
import { OrderRequest } from '../../../domain/commerce/entities/OrderRequest';
import { Money } from '../../../domain/shared/Money';
import { Result } from '../../../domain/shared/Result';
import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { PAYMENT_METHOD } from '../../../domain/commerce/enums/payment-method.enum';
import { COMMERCE_RESTAURANT_STATUS } from '../../../domain/commerce/enums/restaurant-status.enum';
import { ORDER_REQUEST_STATUS } from '../../../domain/commerce/enums/order-request-status.enum';

import { ICatalogGateway } from '../../../domain/commerce/services/ICatalogGateway';
import { IEventBus } from '../../../application/shared/events/IEventBus';
import {
  CartMenuItemView,
  CheckoutRestaurant,
  CheckoutMenuItem,
  CheckoutServiceability,
} from '../../../domain/commerce/types/CatalogGatewayRead';

import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoUnitOfWork } from '../../../infrastructure/database/MongoUnitOfWork';
import { MongoOutboxStore } from '../../../infrastructure/database/MongoOutboxStore';
import { MongoOrderRequestRepository } from '../../../infrastructure/repositories/OrderRequestRepository';
import { MongoCartRepository } from '../../../infrastructure/repositories/CartRepository';
import { OrderRequestModel } from '../../../infrastructure/database/models/OrderRequestModel';
import { CartModel } from '../../../infrastructure/database/models/CartModel';
import { OutboxEventModel } from '../../../infrastructure/database/models/OutboxEventModel';
import { getConnection } from '../../../infrastructure/database/connection';
import { makeAddressResolver } from '../../mocks/commerce.mocks';

const money = (amount: number, currency = 'INR') => Money.create(amount, currency).getValue();

const ADDRESS: CheckoutRequestDto['deliveryAddress'] = {
  label: 'Home',
  street: '1 MG Road',
  city: 'Bengaluru',
  state: 'Karnataka',
  pinCode: '560001',
  coordinates: { lat: 12.97, lng: 77.59 },
};

function buildCart(customerId: string): Cart {
  const cart = Cart.create(customerId).getValue();
  const selection = LineItemSelection.create({
    menuItemId: 'menu-1',
    selectedOptionIds: ['opt-large'],
    quantity: 2,
  }).getValue();
  cart.addItem('rest-1', selection, money(1200));
  cart.pullDomainEvents();
  return cart;
}

function fakeGateway(): ICatalogGateway {
  const restaurant: CheckoutRestaurant = {
    restaurantId: 'rest-1',
    name: 'Pizza Place',
    status: COMMERCE_RESTAURANT_STATUS.ACTIVE,
    isOpen: true,
  };
  const items: CheckoutMenuItem[] = [
    { menuItemId: 'menu-1', restaurantId: 'rest-1', name: 'Margherita', categoryId: 'cat-1', basePrice: money(1000), isAvailable: true },
  ];
  const serviceability: CheckoutServiceability = {
    serviceable: true,
    distanceMeters: 3000,
    deliveryFee: money(4000),
    minOrder: money(2000),
  };
  return {
    getRestaurantForCheckout: async () => Result.ok(restaurant),
    getItemsSnapshot: async () => Result.ok(items),
    checkServiceability: async () => Result.ok(serviceability),
    isRestaurantOpen: async () => Result.ok(true),
    // Variant option groups for checkout option resolution.
    getRestaurantForCart: async () => Result.ok(null),
    getItemsForCart: async () => Result.ok([variantView()]),
  };
}

function variantView(): CartMenuItemView {
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

function fakeEventBus(): { bus: IEventBus; published: DomainEvent[] } {
  const published: DomainEvent[] = [];
  return {
    published,
    bus: {
      subscribe: () => undefined,
      publish: async (e) => {
        published.push(e);
      },
      publishAll: async (events) => {
        published.push(...events);
      },
    },
  };
}

function buildAssembler(): CheckoutContextAssembler {
  return new CheckoutContextAssembler(
    fakeGateway(),
    new PromotionService(buildDefaultCommerceCoupons()),
    buildDefaultCommercePricingPolicy()
  );
}

function uniqueCustomerId(): string {
  return `customer-${randomUUID().slice(0, 8)}`;
}

describe('Checkout (integration)', () => {
  let txContext: TransactionContext;
  let cartRepo: MongoCartRepository;
  let orderRepo: MongoOrderRequestRepository;
  let outboxStore: MongoOutboxStore;
  let unitOfWork: MongoUnitOfWork;

  beforeEach(() => {
    txContext = new TransactionContext();
    cartRepo = new MongoCartRepository(txContext);
    orderRepo = new MongoOrderRequestRepository(txContext);
    outboxStore = new MongoOutboxStore(txContext);
    unitOfWork = new MongoUnitOfWork(getConnection(), txContext);
  });

  afterEach(async () => {
    await Promise.all([OrderRequestModel.deleteMany({}), CartModel.deleteMany({}), OutboxEventModel.deleteMany({})]);
  });

  function dto(customerId: string, idempotencyKey?: string): CheckoutRequestDto {
    return {
      customerId,
      idempotencyKey: idempotencyKey ?? randomUUID(),
      paymentMethod: PAYMENT_METHOD.UPI,
      deliveryAddress: ADDRESS,
    };
  }

  it('persists the OrderRequest + outbox rows and clears the cart atomically', async () => {
    const customerId = uniqueCustomerId();
    await cartRepo.save(buildCart(customerId));

    const eventBus = fakeEventBus();
    const checkout = new Checkout(cartRepo, orderRepo, buildAssembler(), makeAddressResolver().resolver, new PricingCalculator(), unitOfWork, outboxStore);

    const result = await checkout.execute(dto(customerId));
    expect(result.isSuccess).toBe(true);
    const summary = result.getValue();
    expect(summary.status).toBe(ORDER_REQUEST_STATUS.REQUESTED);
    expect(summary.pricing.total).toEqual({ amount: 7560, currency: 'INR' });

    const persisted = await orderRepo.findById(summary.orderRequestId);
    expect(persisted).toBeInstanceOf(OrderRequest);
    expect((persisted as OrderRequest).idempotencyKey.value).toBe(summary.idempotencyKey);

    // Phase 6: `OrderRequested` is the only event checkout raises — the one message whose loss
    // would leave a paid order the restaurant never sees.
    const rows = await OutboxEventModel.find({ aggregateId: summary.orderRequestId }).lean();
    expect(rows.map((r) => r.eventName)).toEqual(['OrderRequested']);

    const cart = await cartRepo.findByCustomerId(customerId);
    expect(cart?.isEmpty).toBe(true);

    // Phase 7.3: the outbox row is the only delivery path — no inline publish.
    expect(eventBus.published).toHaveLength(0);
  });

  it('returns the original OrderRequest on idempotent replay without creating a duplicate', async () => {
    const customerId = uniqueCustomerId();
    await cartRepo.save(buildCart(customerId));

    const checkout = new Checkout(cartRepo, orderRepo, buildAssembler(), makeAddressResolver().resolver, new PricingCalculator(), unitOfWork, outboxStore);

    const key = randomUUID();
    const first = await checkout.execute(dto(customerId, key));
    expect(first.isSuccess).toBe(true);

    const replay = await checkout.execute(dto(customerId, key));
    expect(replay.isSuccess).toBe(true);
    expect(replay.getValue().orderRequestId).toBe(first.getValue().orderRequestId);

    expect(await OrderRequestModel.countDocuments({})).toBe(1);
  });

  it('rolls back the OrderRequest and outbox rows when the commit fails', async () => {
    const customerId = uniqueCustomerId();
    await cartRepo.save(buildCart(customerId));

    const failingCartRepo = Object.create(cartRepo) as MongoCartRepository;
    (failingCartRepo as unknown as { save: () => Promise<void> }).save = async () => {
      throw new Error('forced commit failure');
    };

    const eventBus = fakeEventBus();
    const checkout = new Checkout(failingCartRepo, orderRepo, buildAssembler(), makeAddressResolver().resolver, new PricingCalculator(), unitOfWork, outboxStore);

    await expect(checkout.execute(dto(customerId))).rejects.toThrow('forced commit failure');

    expect(await OrderRequestModel.countDocuments({})).toBe(0);
    expect(await OutboxEventModel.countDocuments({})).toBe(0);
    expect(eventBus.published).toHaveLength(0);
    const cart = await cartRepo.findByCustomerId(customerId);
    expect(cart?.isEmpty).toBe(false);
  });
});
