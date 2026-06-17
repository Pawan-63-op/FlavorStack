import { randomUUID } from 'crypto';
import { Cart } from '../../../domain/commerce/entities/Cart';
import { ConflictError } from '../../../domain/shared/errors/ConflictError';
import { getConnection } from '../../../infrastructure/database/connection';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoUnitOfWork } from '../../../infrastructure/database/MongoUnitOfWork';
import { MongoCartRepository } from '../../../infrastructure/repositories/CartRepository';
import { CartModel } from '../../../infrastructure/database/models/CartModel';
import { buildCartWithItem, buildSelection, buildMoney } from './commerce-fixtures';
import { AppliedPromotion } from '../../../domain/commerce/value-objects/AppliedPromotion';
import { PROMOTION_KIND } from '../../../domain/commerce/enums/promotion-kind.enum';

function uniqueCustomerId(): string {
  return `customer-${randomUUID().slice(0, 8)}`;
}

describe('MongoCartRepository', () => {
  let txContext: TransactionContext;
  let repo: MongoCartRepository;

  beforeEach(() => {
    txContext = new TransactionContext();
    repo = new MongoCartRepository(txContext);
  });

  afterEach(async () => {
    await CartModel.deleteMany({});
  });

  describe('aggregate round-trip', () => {
    it('saves and rehydrates a Cart with items', async () => {
      const customerId = uniqueCustomerId();
      const original = buildCartWithItem(customerId);
      await repo.save(original);

      const found = await repo.findById(original.id.toString());
      expect(found).toBeInstanceOf(Cart);
      const cart = found as Cart;

      expect(cart.id.toString()).toBe(original.id.toString());
      expect(cart.customerId).toBe(customerId);
      expect(cart.restaurantId).toBe('restaurant-1');
      expect(cart.currency).toBe('INR');
      expect(cart.version).toBe(original.version);
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].menuItemId).toBe('menu-1');
      expect(cart.items[0].quantity.value).toBe(1);
      expect(cart.items[0].unitPriceSnapshot.amount).toBe(1000);
      expect(cart.items[0].unitPriceSnapshot.currency).toBe('INR');
      // reconstitute raises no domain events
      expect(cart.pullDomainEvents()).toEqual([]);
    });

    it('saves and rehydrates an applied promotion (Phase 8)', async () => {
      const customerId = uniqueCustomerId();
      const original = buildCartWithItem(customerId);
      const promo = AppliedPromotion.create({
        code: 'SAVE10',
        kind: PROMOTION_KIND.PERCENTAGE,
        discount: buildMoney(100),
        sourceRef: 'coupon:SAVE10',
      }).getValue();
      original.applyPromotion(promo);
      await repo.save(original);

      const cart = (await repo.findById(original.id.toString())) as Cart;
      expect(cart.appliedPromotion).not.toBeNull();
      expect(cart.appliedPromotion!.code).toBe('SAVE10');
      expect(cart.appliedPromotion!.kind).toBe(PROMOTION_KIND.PERCENTAGE);
      expect(cart.appliedPromotion!.discount.amount).toBe(100);
      expect(cart.appliedPromotion!.sourceRef).toBe('coupon:SAVE10');
    });

    it('returns null for an unknown id', async () => {
      expect(await repo.findById(randomUUID())).toBeNull();
    });

    it('finds a cart by customerId', async () => {
      const customerId = uniqueCustomerId();
      const original = buildCartWithItem(customerId);
      await repo.save(original);

      const found = await repo.findByCustomerId(customerId);
      expect(found?.id.toString()).toBe(original.id.toString());
    });

    it('returns null from findByCustomerId when no cart exists', async () => {
      expect(await repo.findByCustomerId(uniqueCustomerId())).toBeNull();
    });
  });

  describe('optimistic concurrency', () => {
    it('persists the new version on a second save', async () => {
      const customerId = uniqueCustomerId();
      const original = buildCartWithItem(customerId);
      await repo.save(original);

      const loaded = (await repo.findById(original.id.toString())) as Cart;
      const before = loaded.version;
      const result = loaded.addItem('restaurant-1', buildSelection({ menuItemId: 'menu-2' }), buildMoney(500));
      expect(result.isSuccess).toBe(true);

      await repo.save(loaded);

      const raw = await CartModel.findById(original.id.toString()).lean();
      expect(raw?.version).toBe(before + 1);
      expect(raw?.items).toHaveLength(2);
    });

    it('throws ConflictError when the version is stale', async () => {
      const customerId = uniqueCustomerId();
      const original = buildCartWithItem(customerId);
      await repo.save(original);

      const loadA = (await repo.findById(original.id.toString())) as Cart;
      const loadB = (await repo.findById(original.id.toString())) as Cart;

      loadA.addItem('restaurant-1', buildSelection({ menuItemId: 'menu-2' }), buildMoney(500));
      await repo.save(loadA); // succeeds, advances persisted version

      loadB.addItem('restaurant-1', buildSelection({ menuItemId: 'menu-3' }), buildMoney(700));
      await expect(repo.save(loadB)).rejects.toBeInstanceOf(ConflictError);
    });

    it('rejects a second cart for the same customer (one active cart per customer)', async () => {
      const customerId = uniqueCustomerId();
      const first = buildCartWithItem(customerId);
      await repo.save(first);

      const second = buildCartWithItem(customerId);
      await expect(repo.save(second)).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('delete', () => {
    it('removes the cart document', async () => {
      const customerId = uniqueCustomerId();
      const original = buildCartWithItem(customerId);
      await repo.save(original);

      await repo.delete(original.id.toString());

      expect(await repo.findById(original.id.toString())).toBeNull();
    });
  });

  describe('transaction participation', () => {
    it('rolls back the save when the transaction throws', async () => {
      const uow = new MongoUnitOfWork(getConnection(), txContext);
      const customerId = uniqueCustomerId();
      const original = buildCartWithItem(customerId);

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
