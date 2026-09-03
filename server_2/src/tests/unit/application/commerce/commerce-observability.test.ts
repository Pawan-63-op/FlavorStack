import { AddToCart } from '../../../../application/commerce/use-cases/AddToCart';
import { GetCart } from '../../../../application/commerce/use-cases/GetCart';
import { Checkout } from '../../../../application/commerce/use-cases/Checkout';
import { CommerceTelemetry, COMMERCE_METRICS, COMMERCE_CHECKOUT_SPAN } from '../../../../application/commerce/observability/CommerceTelemetry';
import { RecordingTelemetry } from '../../../mocks/telemetry.mocks';
import { InMemoryCartRepository } from '../../../mocks/commerce.mocks';
import { InMemoryUnitOfWork } from '../../../mocks/identity.mocks';
import { createEventBusSpy } from '../../../mocks/shared.mocks';

import { CheckoutContextAssembler } from '../../../../application/commerce/services/CheckoutContextAssembler';
import { PricingCalculator } from '../../../../infrastructure/services/PricingCalculator';
import { PromotionService } from '../../../../infrastructure/services/PromotionService';
import { buildDefaultCommerceCoupons } from '../../../../infrastructure/services/CommerceCouponCatalog';
import { buildDefaultCommercePricingPolicy } from '../../../../infrastructure/services/CommercePricingConfig';
import { Cart } from '../../../../domain/commerce/entities/Cart';
import { LineItemSelection } from '../../../../domain/commerce/value-objects/LineItemSelection';
import { OrderRequest } from '../../../../domain/commerce/entities/OrderRequest';
import { Money } from '../../../../domain/shared/Money';
import { Result } from '../../../../domain/shared/Result';
import { DomainEvent } from '../../../../domain/shared/DomainEvent';
import { ICartRepository } from '../../../../domain/commerce/repositories/ICartRepository';
import { IOrderRequestRepository } from '../../../../domain/commerce/repositories/IOrderRequestRepository';
import { ICatalogGateway } from '../../../../domain/commerce/services/ICatalogGateway';
import { ICartValidator } from '../../../../domain/commerce/services/ICartValidator';
import { IUnitOfWork } from '../../../../application/shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../../../application/shared/outbox/IOutboxStore';
import { ValidationReport, VALIDATION_ISSUE_CODE, VALIDATION_SEVERITY } from '../../../../domain/commerce/types/ValidationReport';
import { COMMERCE_RESTAURANT_STATUS } from '../../../../domain/commerce/enums/restaurant-status.enum';
import { PAYMENT_METHOD } from '../../../../domain/commerce/enums/payment-method.enum';
import { CartMenuItemView } from '../../../../domain/commerce/types/CatalogGatewayRead';
import { CheckoutRequestDto } from '../../../../application/commerce/dtos/CheckoutRequestDto';
import { IdempotencyKey } from '../../../../domain/commerce/value-objects/IdempotencyKey';
import { makeAddressResolver } from '../../../mocks/commerce.mocks';

const money = (amount: number) => Money.create(amount, 'INR').getValue();

describe('AddToCart observability', () => {
  it('increments the cart-add counter and logs', async () => {
    const rec = new RecordingTelemetry();
    const useCase = new AddToCart(
      new InMemoryCartRepository(),
      new InMemoryUnitOfWork(),
      createEventBusSpy(),
      new CommerceTelemetry(rec)
    );

    const result = await useCase.execute({
      customerId: 'c1',
      restaurantId: 'r1',
      menuItemId: 'm1',
      selectedOptionIds: [],
      quantity: 2,
      unitPrice: { amount: 1500, currency: 'INR' },
    });

    expect(result.isSuccess).toBe(true);
    expect(rec.counter(COMMERCE_METRICS.cartAddTotal)).toBe(1);
    expect(rec.messages()).toContain('commerce.cart.item_added');
  });
});

describe('GetCart observability', () => {
  function fakeValidator(report: ValidationReport): ICartValidator {
    return { validate: () => Result.ok(report) };
  }
  const noCatalog = {
    getRestaurantForCart: async () => Result.ok(null),
    getItemsForCart: async () => Result.ok([]),
    getRestaurantForCheckout: async () => Result.fail('unused'),
    getItemsSnapshot: async () => Result.ok([]),
    checkServiceability: async () => Result.fail('unused'),
    isRestaurantOpen: async () => Result.ok(false),
  } as unknown as ICatalogGateway;

  function cartWithItem(): ICartRepository {
    const cart = Cart.create('c1').getValue();
    cart.addItem('r1', LineItemSelection.create({ menuItemId: 'm1', selectedOptionIds: [], quantity: 1 }).getValue(), money(1000));
    cart.pullDomainEvents();
    return {
      findById: async () => cart,
      findByCustomerId: async () => cart,
      save: async () => undefined,
      delete: async () => undefined,
    };
  }

  it('counts each ERROR-severity validation issue by reason', async () => {
    const rec = new RecordingTelemetry();
    const report: ValidationReport = {
      isValid: false,
      issues: [
        { code: VALIDATION_ISSUE_CODE.ITEM_UNAVAILABLE, severity: VALIDATION_SEVERITY.ERROR, message: 'x', menuItemId: 'm1' },
        { code: VALIDATION_ISSUE_CODE.MIN_ORDER_NOT_MET, severity: VALIDATION_SEVERITY.WARNING, message: 'y' },
      ],
    };
    const useCase = new GetCart(cartWithItem(), noCatalog, fakeValidator(report), new CommerceTelemetry(rec));

    const result = await useCase.execute({ customerId: 'c1' });

    expect(result.isSuccess).toBe(true);
    expect(rec.counter(COMMERCE_METRICS.validationRejectionTotal, { reason: VALIDATION_ISSUE_CODE.ITEM_UNAVAILABLE })).toBe(1);
    expect(rec.counter(COMMERCE_METRICS.validationRejectionTotal, { reason: VALIDATION_ISSUE_CODE.MIN_ORDER_NOT_MET })).toBe(0);
  });
});

describe('Checkout observability', () => {
  function buildCart(): Cart {
    const cart = Cart.create('cust-1').getValue();
    cart.addItem('rest-1', LineItemSelection.create({ menuItemId: 'menu-1', selectedOptionIds: ['opt-large'], quantity: 2 }).getValue(), money(1200));
    cart.pullDomainEvents();
    return cart;
  }

  const fakeGateway: ICatalogGateway = {
    getRestaurantForCheckout: async () => Result.ok({ restaurantId: 'rest-1', name: 'Pizza Place', status: COMMERCE_RESTAURANT_STATUS.ACTIVE, isOpen: true }),
    getItemsSnapshot: async () => Result.ok([{ menuItemId: 'menu-1', restaurantId: 'rest-1', name: 'Margherita', categoryId: 'cat-1', basePrice: money(1000), isAvailable: true }]),
    checkServiceability: async () => Result.ok({ serviceable: true, distanceMeters: 3000, deliveryFee: money(4000), minOrder: money(2000) }),
    isRestaurantOpen: async () => Result.ok(true),
    // Variant option groups for checkout option resolution.
    getRestaurantForCart: async () => Result.ok(null),
    getItemsForCart: async () => Result.ok([variantView]),
  };

  const variantView: CartMenuItemView = {
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
        groupId: 'size', label: 'Size', selectionType: 'single', required: true, minSelect: 1, maxSelect: 1,
        options: [{ optionId: 'opt-large', label: 'Large', priceDeltaAmount: 200, currency: 'INR', isDefault: false, isAvailable: true }],
      },
    ],
  };
  function orderRepo(existing: OrderRequest | null): IOrderRequestRepository {
    return {
      findById: async () => null,
      findByIdempotencyKey: async () => existing,
      save: async () => undefined,
    };
  }
  function cartRepo(cart: Cart | null): ICartRepository {
    return { findById: async () => cart, findByCustomerId: async () => cart, save: async () => undefined, delete: async () => undefined };
  }
  const uow: IUnitOfWork = { runInTransaction: async (work) => work({ session: 'fake' } as never) };
  const outbox: IOutboxStore = { append: async (_e: DomainEvent[]) => undefined };

  function build(rec: RecordingTelemetry, opts: { cart?: Cart | null; existing?: OrderRequest | null } = {}): Checkout {
    const assembler = new CheckoutContextAssembler(fakeGateway, new PromotionService(buildDefaultCommerceCoupons()), buildDefaultCommercePricingPolicy());
    return new Checkout(
      cartRepo(opts.cart === undefined ? buildCart() : opts.cart),
      orderRepo(opts.existing ?? null),
      assembler,
      makeAddressResolver().resolver,
      new PricingCalculator(),
      uow,
      outbox,
      new CommerceTelemetry(rec)
    );
  }

  function dto(overrides: Partial<CheckoutRequestDto> = {}): CheckoutRequestDto {
    return {
      customerId: 'cust-1',
      idempotencyKey: '11111111-1111-1111-1111-111111111111',
      paymentMethod: PAYMENT_METHOD.UPI,
      deliveryAddress: { label: 'Home', street: '1 MG Road', city: 'Bengaluru', state: 'Karnataka', pinCode: '560001', coordinates: { lat: 12.97, lng: 77.59 } },
      ...overrides,
    };
  }

  it('on success: counts success, records pricing latency, audits, ends span ok', async () => {
    const rec = new RecordingTelemetry();
    const result = await build(rec).execute(dto());

    expect(result.isSuccess).toBe(true);
    expect(rec.counter(COMMERCE_METRICS.checkoutTotal, { result: 'success' })).toBe(1);
    expect(rec.observed(COMMERCE_METRICS.pricingLatencyMs)).toHaveLength(1);
    expect(rec.messages()).toContain('commerce.order_request.created');
    const span = rec.spans.find((s) => s.name === COMMERCE_CHECKOUT_SPAN);
    expect(span?.outcome).toBe('ended');
  });

  it('on idempotent replay: counts replay, does not count success, ends span', async () => {
    const rec = new RecordingTelemetry();
    const fixtures = require('../../../integration/commerce/commerce-fixtures');
    const existing: OrderRequest = fixtures.buildOrderRequest('cust-1', {
      idempotencyKey: IdempotencyKey.create('22222222-2222-2222-2222-222222222222').getValue(),
    });
    const result = await build(rec, { existing }).execute(dto({ idempotencyKey: '22222222-2222-2222-2222-222222222222' }));

    expect(result.isSuccess).toBe(true);
    expect(rec.counter(COMMERCE_METRICS.checkoutIdempotentReplayTotal)).toBe(1);
    expect(rec.counter(COMMERCE_METRICS.checkoutTotal, { result: 'success' })).toBe(0);
    expect(rec.spans.find((s) => s.name === COMMERCE_CHECKOUT_SPAN)?.endFields?.replayed).toBe(true);
  });

  it('on failure (no cart): counts failure with reason, fails the span', async () => {
    const rec = new RecordingTelemetry();
    const result = await build(rec, { cart: null }).execute(dto());

    expect(result.isFailure).toBe(true);
    expect(rec.counter(COMMERCE_METRICS.checkoutTotal, { result: 'failure' })).toBe(1);
    expect(rec.counter(COMMERCE_METRICS.checkoutFailureTotal, { reason: 'NOT_FOUND' })).toBe(1);
    expect(rec.spans.find((s) => s.name === COMMERCE_CHECKOUT_SPAN)?.outcome).toBe('failed');
  });
});
