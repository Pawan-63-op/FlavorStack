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
import { Money } from '../../../domain/shared/Money';
import { Result } from '../../../domain/shared/Result';
import { ConflictError } from '../../../domain/shared/errors/ConflictError';
import { PAYMENT_METHOD } from '../../../domain/commerce/enums/payment-method.enum';
import { COMMERCE_RESTAURANT_STATUS } from '../../../domain/commerce/enums/restaurant-status.enum';

import { ICatalogGateway } from '../../../domain/commerce/services/ICatalogGateway';
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

describe('Checkout — simultaneous double-submit (concurrency)', () => {
  let txContext: TransactionContext;
  let cartRepo: MongoCartRepository;
  let orderRepo: MongoOrderRequestRepository;
  let outboxStore: MongoOutboxStore;
  let unitOfWork: MongoUnitOfWork;

  beforeAll(async () => {
    await OrderRequestModel.createIndexes();
  });

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

  function dto(customerId: string, idempotencyKey: string): CheckoutRequestDto {
    return {
      customerId,
      idempotencyKey,
      paymentMethod: PAYMENT_METHOD.UPI,
      deliveryAddress: ADDRESS,
    };
  }

  function newCheckout(): Checkout {
    return new Checkout(cartRepo, orderRepo, buildAssembler(), makeAddressResolver().resolver, new PricingCalculator(), unitOfWork, outboxStore);
  }

  it('N concurrent submits with the SAME idempotency key create exactly one OrderRequest', async () => {
    const customerId = uniqueCustomerId();
    await cartRepo.save(buildCart(customerId));
    const key = randomUUID();

    const FANOUT = 5;
    const settled = await Promise.allSettled(
      Array.from({ length: FANOUT }, () => newCheckout().execute(dto(customerId, key)))
    );

    expect(await OrderRequestModel.countDocuments({})).toBe(1);
    const theOrder = await OrderRequestModel.findOne({}).lean();
    const winnerId = String(theOrder!._id);

    const rows = await OutboxEventModel.find({ aggregateId: winnerId }).lean();
    expect(rows.map((r) => r.eventName)).toEqual(['OrderRequested']);
    expect(await OutboxEventModel.countDocuments({})).toBe(1);

    const fulfilled = settled.filter(
      (s): s is PromiseFulfilledResult<Awaited<ReturnType<Checkout['execute']>>> => s.status === 'fulfilled'
    );
    const successes = fulfilled.filter((s) => s.value.isSuccess);
    expect(successes.length).toBeGreaterThanOrEqual(1);
    for (const s of successes) {
      expect(s.value.getValue().orderRequestId).toBe(winnerId);
    }

    const rejected = settled.filter((s): s is PromiseRejectedResult => s.status === 'rejected');
    for (const r of rejected) {
      expect(r.reason).toBeInstanceOf(ConflictError);
    }
    for (const s of fulfilled) {
      if (s.value.isSuccess) {
        expect(s.value.getValue().orderRequestId).toBe(winnerId);
      }
    }

    const cart = await cartRepo.findByCustomerId(customerId);
    expect(cart?.isEmpty).toBe(true);
  });
});
