import { randomUUID } from 'crypto';
import { OrderRequest } from '../../../domain/commerce/entities/OrderRequest';
import { IdempotencyKey } from '../../../domain/commerce/value-objects/IdempotencyKey';
import { ORDER_REQUEST_STATUS } from '../../../domain/commerce/enums/order-request-status.enum';
import { PAYMENT_METHOD } from '../../../domain/commerce/enums/payment-method.enum';
import { COMMERCE_RESTAURANT_STATUS } from '../../../domain/commerce/enums/restaurant-status.enum';
import { ConflictError } from '../../../domain/shared/errors/ConflictError';
import { getConnection } from '../../../infrastructure/database/connection';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoUnitOfWork } from '../../../infrastructure/database/MongoUnitOfWork';
import { MongoOrderRequestRepository } from '../../../infrastructure/repositories/OrderRequestRepository';
import { OrderRequestModel } from '../../../infrastructure/database/models/OrderRequestModel';
import { buildOrderRequest } from './commerce-fixtures';

function uniqueCustomerId(): string {
  return `customer-${randomUUID().slice(0, 8)}`;
}

describe('MongoOrderRequestRepository', () => {
  let txContext: TransactionContext;
  let repo: MongoOrderRequestRepository;

  beforeEach(() => {
    txContext = new TransactionContext();
    repo = new MongoOrderRequestRepository(txContext);
  });

  afterEach(async () => {
    await OrderRequestModel.deleteMany({});
  });

  describe('aggregate round-trip', () => {
    it('saves and rehydrates an OrderRequest with full snapshot/pricing fidelity', async () => {
      const customerId = uniqueCustomerId();
      const original = buildOrderRequest(customerId);
      await repo.save(original);

      const found = await repo.findById(original.id.toString());
      expect(found).toBeInstanceOf(OrderRequest);
      const order = found as OrderRequest;

      expect(order.id.toString()).toBe(original.id.toString());
      expect(order.customerId).toBe(customerId);
      expect(order.status).toBe(ORDER_REQUEST_STATUS.REQUESTED);
      expect(order.schemaVersion).toBe(original.schemaVersion);
      expect(order.idempotencyKey.value).toBe(original.idempotencyKey.value);
      expect(order.createdAt.getTime()).toBe(original.createdAt.getTime());

      expect(order.restaurant.restaurantId).toBe('restaurant-1');
      expect(order.restaurant.status).toBe(COMMERCE_RESTAURANT_STATUS.ACTIVE);
      expect(order.restaurant.openAtCheckout).toBe(true);
      expect(order.restaurant.deliveryFeeInputs.feeTiers[0].fee.amount).toBe(40);
      expect(order.restaurant.deliveryFeeInputs.freeAboveSubtotal?.amount).toBe(50000);

      expect(order.lines).toHaveLength(2);
      expect(order.lines[0].menuItem.menuItemId).toBe('menu-1');
      expect(order.lines[0].menuItem.basePrice.amount).toBe(1000);
      expect(order.lines[0].quantity.value).toBe(2);
      expect(order.lines[0].lineTotal.amount).toBe(2400);
      expect(order.lines[0].selectedOptions).toHaveLength(1);
      expect(order.lines[0].selectedOptions[0].optionId).toBe('opt-large');
      expect(order.lines[0].selectedOptions[0].priceDelta.amount).toBe(200);
      expect(order.lines[1].selectedOptions).toHaveLength(0);

      expect(order.pricing.subtotal.amount).toBe(2900);
      expect(order.pricing.fees).toHaveLength(1);
      expect(order.pricing.discount.amount).toBe(100);
      expect(order.pricing.tax.amount).toBe(150);
      expect(order.pricing.total.amount).toBe(3000);

      expect(order.deliveryAddress.pinCode).toBe('560001');
      expect(order.deliveryAddress.coordinates.lat).toBeCloseTo(12.97);
      expect(order.paymentIntent.method).toBe(PAYMENT_METHOD.UPI);

      expect(order.pullDomainEvents()).toEqual([]);
    });

    it('finds an OrderRequest by idempotency key', async () => {
      const customerId = uniqueCustomerId();
      const original = buildOrderRequest(customerId);
      await repo.save(original);

      const found = await repo.findByIdempotencyKey(original.idempotencyKey.value);
      expect(found?.id.toString()).toBe(original.id.toString());
    });

    it('returns null for an unknown id', async () => {
      expect(await repo.findById(randomUUID())).toBeNull();
    });

    it('returns null from findByIdempotencyKey when no request exists', async () => {
      expect(await repo.findByIdempotencyKey(randomUUID())).toBeNull();
    });
  });

  describe('write-once / append-only', () => {
    it('rejects re-saving the same OrderRequest (duplicate id)', async () => {
      const customerId = uniqueCustomerId();
      const original = buildOrderRequest(customerId);
      await repo.save(original);

      await expect(repo.save(original)).rejects.toBeInstanceOf(ConflictError);
    });

    it('rejects a different OrderRequest reusing an idempotency key', async () => {
      const customerId = uniqueCustomerId();
      const key = IdempotencyKey.generate();
      await repo.save(buildOrderRequest(customerId, { idempotencyKey: key }));

      const duplicate = buildOrderRequest(uniqueCustomerId(), { idempotencyKey: key });
      await expect(repo.save(duplicate)).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('transaction participation', () => {
    it('rolls back the save when the transaction throws', async () => {
      const uow = new MongoUnitOfWork(getConnection(), txContext);
      const original = buildOrderRequest(uniqueCustomerId());

      await expect(
        uow.runInTransaction(async () => {
          await repo.save(original);
          throw new Error('work failed');
        })
      ).rejects.toThrow('work failed');

      expect(await repo.findById(original.id.toString())).toBeNull();
    });
  });
});
