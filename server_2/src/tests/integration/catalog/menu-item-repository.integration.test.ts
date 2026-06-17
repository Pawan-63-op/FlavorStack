import { randomUUID } from 'crypto';
import { MenuItem } from '../../../domain/catalog/entities/MenuItem';
import { ItemAvailability } from '../../../domain/catalog/value-objects/ItemAvailability.vo';
import { Money } from '../../../domain/shared/Money';
import { ConflictError } from '../../../domain/shared/errors/ConflictError';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoMenuItemRepository } from '../../../infrastructure/repositories/MenuItemRepository';
import { MenuItemModel } from '../../../infrastructure/database/models/MenuItemModel';
import { buildMenuItem } from './catalog-fixtures';

describe('MongoMenuItemRepository', () => {
  let txContext: TransactionContext;
  let repo: MongoMenuItemRepository;

  beforeEach(() => {
    txContext = new TransactionContext();
    repo = new MongoMenuItemRepository(txContext);
  });

  afterEach(async () => {
    await MenuItemModel.deleteMany({});
  });

  describe('aggregate round-trip', () => {
    it('saves and rehydrates a MenuItem with variant groups and options', async () => {
      const original = buildMenuItem({ withVariants: true });
      await repo.save(original);

      const found = await repo.findById(original.id.toString());
      expect(found).toBeInstanceOf(MenuItem);
      const item = found as MenuItem;

      expect(item.id.toString()).toBe(original.id.toString());
      expect(item.name).toBe('Paneer Tikka');
      expect(item.basePrice.amount).toBe(25000);
      expect(item.tags).toEqual(['spicy', 'popular']);
      expect(item.dietary).toEqual(['VEG']);
      expect(item.availability.isAvailable).toBe(true);
      expect(item.variantGroups).toHaveLength(1);
      const group = item.variantGroups[0];
      expect(group.label).toBe('Size');
      expect(group.options).toHaveLength(2);
      expect(group.id.toString()).toBe(original.variantGroups[0].id.toString());

      // price resolution survives the round-trip
      const fullOptionId = group.options.find((o) => o.label === 'Full')!.id.toString();
      const priced = item.priceFor([fullOptionId]);
      expect(priced.isSuccess).toBe(true);
      expect(priced.getValue().amount).toBe(35000);

      expect(item.pullDomainEvents()).toEqual([]);
    });

    it('returns null for an unknown id', async () => {
      expect(await repo.findById(randomUUID())).toBeNull();
    });
  });

  describe('soft delete', () => {
    it('hides the item from finders but keeps the document', async () => {
      const original = buildMenuItem();
      await repo.save(original);

      await repo.softDelete(original.id.toString());

      expect(await repo.findById(original.id.toString())).toBeNull();
      const raw = await MenuItemModel.findById(original.id.toString()).lean();
      expect(raw?.deletedAt).not.toBeNull();
    });
  });

  describe('optimistic locking', () => {
    it('persists the new version and price on update', async () => {
      const original = buildMenuItem();
      await repo.save(original);

      const loaded = (await repo.findById(original.id.toString())) as MenuItem;
      const before = loaded.version;
      loaded.changePrice(Money.create(30000).getValue());
      await repo.update(loaded);

      const raw = await MenuItemModel.findById(original.id.toString()).lean();
      expect(raw?.version).toBe(before + 1);
      expect(raw?.basePrice.amount).toBe(30000);
    });

    it('throws ConflictError when the version is stale', async () => {
      const original = buildMenuItem();
      await repo.save(original);

      const loadA = (await repo.findById(original.id.toString())) as MenuItem;
      const loadB = (await repo.findById(original.id.toString())) as MenuItem;

      loadA.changePrice(Money.create(30000).getValue());
      await repo.update(loadA);

      loadB.changePrice(Money.create(40000).getValue());
      await expect(repo.update(loadB)).rejects.toBeInstanceOf(ConflictError);
    });

    it('round-trips an availability toggle', async () => {
      const original = buildMenuItem();
      await repo.save(original);

      const loaded = (await repo.findById(original.id.toString())) as MenuItem;
      loaded.toggleAvailability(
        ItemAvailability.create({ isAvailable: false, outOfStockReason: 'Sold out' }).getValue()
      );
      await repo.update(loaded);

      const reloaded = (await repo.findById(original.id.toString())) as MenuItem;
      expect(reloaded.availability.isAvailable).toBe(false);
      expect(reloaded.availability.outOfStockReason).toBe('Sold out');
    });
  });

  describe('finders by reference', () => {
    it('lists items by restaurant and by category, excluding soft-deleted', async () => {
      const restaurantId = `rest-${randomUUID().slice(0, 6)}`;
      const categoryId = `cat-${randomUUID().slice(0, 6)}`;
      const a = buildMenuItem({ restaurantId, categoryId });
      const b = buildMenuItem({ restaurantId, categoryId });
      const other = buildMenuItem({ restaurantId, categoryId: `cat-other` });
      await repo.save(a);
      await repo.save(b);
      await repo.save(other);
      await repo.softDelete(b.id.toString());

      const byRestaurant = await repo.findByRestaurant(restaurantId, { limit: 50 });
      const restIds = byRestaurant.items.map((i) => i.id.toString());
      expect(restIds).toContain(a.id.toString());
      expect(restIds).toContain(other.id.toString());
      expect(restIds).not.toContain(b.id.toString());

      const byCategory = await repo.findByCategory(categoryId, { limit: 50 });
      const catIds = byCategory.items.map((i) => i.id.toString());
      expect(catIds).toEqual([a.id.toString()]);
    });
  });
});
