import { randomUUID } from 'crypto';
import { Restaurant } from '../../../domain/catalog/entities/Restaurant';
import { CatalogVisibility } from '../../../domain/catalog/value-objects/CatalogVisibility.vo';
import { CATALOG_VISIBILITY } from '../../../domain/catalog/enums/catalog-visibility.enum';
import { RESTAURANT_STATUS } from '../../../domain/catalog/enums/restaurant-status.enum';
import { ConflictError } from '../../../domain/shared/errors/ConflictError';
import { getConnection } from '../../../infrastructure/database/connection';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoUnitOfWork } from '../../../infrastructure/database/MongoUnitOfWork';
import { MongoRestaurantRepository } from '../../../infrastructure/repositories/RestaurantRepository';
import { RestaurantModel } from '../../../infrastructure/database/models/RestaurantModel';
import { buildRestaurant } from './catalog-fixtures';

function uniqueSlug(): string {
  return `r-${randomUUID().slice(0, 8)}`;
}

describe('MongoRestaurantRepository', () => {
  let txContext: TransactionContext;
  let repo: MongoRestaurantRepository;

  beforeEach(() => {
    txContext = new TransactionContext();
    repo = new MongoRestaurantRepository(txContext);
  });

  afterEach(async () => {
    await RestaurantModel.deleteMany({});
  });

  describe('aggregate round-trip', () => {
    it('saves and rehydrates a Restaurant with categories, zones and opening hours', async () => {
      const original = buildRestaurant({
        slug: uniqueSlug(),
        withCategory: true,
        withZone: true,
        withOpeningHours: true,
      });
      await repo.save(original);

      const found = await repo.findById(original.id.toString());
      expect(found).toBeInstanceOf(Restaurant);
      const r = found as Restaurant;

      expect(r.id.toString()).toBe(original.id.toString());
      expect(r.ownerId).toBe(original.ownerId);
      expect(r.slug).toBe(original.slug);
      expect(r.status.value).toBe(RESTAURANT_STATUS.DRAFT);
      expect(r.visibility.value).toBe(CATALOG_VISIBILITY.HIDDEN);
      expect(r.cuisineTypes.map((c) => c.value)).toEqual(['NORTH_INDIAN', 'CHINESE']);
      expect(r.address.equals(original.address)).toBe(true);
      expect(r.location.equals(original.location)).toBe(true);
      expect(r.categories).toHaveLength(1);
      expect(r.categories[0].label).toBe('Starters');
      expect(r.categories[0].id.toString()).toBe(original.categories[0].id.toString());
      expect(r.deliveryZones).toHaveLength(1);
      expect(r.deliveryZones[0].minOrder.amount).toBe(10000);
      expect(r.openingHours?.equals(original.openingHours!)).toBe(true);
      expect(r.version).toBe(original.version);
      // reconstitute raises no domain events
      expect(r.pullDomainEvents()).toEqual([]);
    });

    it('returns null for an unknown id', async () => {
      expect(await repo.findById(randomUUID())).toBeNull();
    });

    it('finds a restaurant by slug', async () => {
      const slug = uniqueSlug();
      const original = buildRestaurant({ slug });
      await repo.save(original);

      const found = await repo.findBySlug(slug);
      expect(found?.id.toString()).toBe(original.id.toString());
    });
  });

  describe('soft delete', () => {
    it('hides the restaurant from finders but keeps the document', async () => {
      const slug = uniqueSlug();
      const original = buildRestaurant({ slug });
      await repo.save(original);

      await repo.softDelete(original.id.toString());

      expect(await repo.findById(original.id.toString())).toBeNull();
      expect(await repo.findBySlug(slug)).toBeNull();

      const raw = await RestaurantModel.findById(original.id.toString()).lean();
      expect(raw).not.toBeNull();
      expect(raw?.deletedAt).not.toBeNull();
    });
  });

  describe('optimistic locking', () => {
    it('persists the new version on update', async () => {
      const original = buildRestaurant({ slug: uniqueSlug() });
      await repo.save(original);

      const loaded = (await repo.findById(original.id.toString())) as Restaurant;
      const before = loaded.version;
      loaded.updateProfile({ name: 'Renamed' });
      await repo.update(loaded);

      const raw = await RestaurantModel.findById(original.id.toString()).lean();
      expect(raw?.version).toBe(before + 1);
      expect(raw?.name).toBe('Renamed');
    });

    it('throws ConflictError when the version is stale', async () => {
      const original = buildRestaurant({ slug: uniqueSlug() });
      await repo.save(original);

      const loadA = (await repo.findById(original.id.toString())) as Restaurant;
      const loadB = (await repo.findById(original.id.toString())) as Restaurant;

      loadA.updateProfile({ name: 'A' });
      await repo.update(loadA); // succeeds, advances persisted version

      loadB.updateProfile({ name: 'B' });
      await expect(repo.update(loadB)).rejects.toBeInstanceOf(ConflictError);
    });

    it('throws ConflictError when updating a missing restaurant', async () => {
      const ghost = buildRestaurant({ slug: uniqueSlug() });
      ghost.updateProfile({ name: 'X' });
      await expect(repo.update(ghost)).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('cursor pagination', () => {
    it('lists by owner and walks pages via nextCursor', async () => {
      const ownerId = `owner-${randomUUID().slice(0, 6)}`;
      for (let i = 0; i < 3; i++) {
        await repo.save(buildRestaurant({ ownerId, slug: uniqueSlug() }));
      }

      const page1 = await repo.findByOwner(ownerId, { limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.nextCursor).toBeDefined();

      const page2 = await repo.findByOwner(ownerId, { limit: 2, cursor: page1.nextCursor });
      expect(page2.items).toHaveLength(1);
      expect(page2.nextCursor).toBeUndefined();

      const ids = new Set([...page1.items, ...page2.items].map((r) => r.id.toString()));
      expect(ids.size).toBe(3);
    });

    it('findAll excludes soft-deleted restaurants', async () => {
      const a = buildRestaurant({ slug: uniqueSlug() });
      const b = buildRestaurant({ slug: uniqueSlug() });
      await repo.save(a);
      await repo.save(b);
      await repo.softDelete(a.id.toString());

      const page = await repo.findAll({ limit: 50 });
      const ids = page.items.map((r) => r.id.toString());
      expect(ids).toContain(b.id.toString());
      expect(ids).not.toContain(a.id.toString());
    });
  });

  describe('text index', () => {
    it('serves a $text search over name/description', async () => {
      await RestaurantModel.init(); // ensure the text index is built
      const original = buildRestaurant({ slug: uniqueSlug() });
      await repo.save(original);

      const hits = await RestaurantModel.find({ $text: { $search: 'Spice' }, deletedAt: null }).lean();
      expect(hits.map((h) => h._id)).toContain(original.id.toString());
    });
  });

  describe('transaction participation', () => {
    it('rolls back the save when the transaction throws', async () => {
      const uow = new MongoUnitOfWork(getConnection(), txContext);
      const original = buildRestaurant({ slug: uniqueSlug() });

      await expect(
        uow.runInTransaction(async () => {
          await repo.save(original);
          throw new Error('work failed');
        })
      ).rejects.toThrow('work failed');

      expect(await repo.findById(original.id.toString())).toBeNull();
    });
  });

  describe('setVisibility round-trip', () => {
    it('persists a visibility change', async () => {
      const original = buildRestaurant({ slug: uniqueSlug() });
      await repo.save(original);

      const loaded = (await repo.findById(original.id.toString())) as Restaurant;
      loaded.setVisibility(CatalogVisibility.create(CATALOG_VISIBILITY.PUBLIC).getValue());
      await repo.update(loaded);

      const reloaded = (await repo.findById(original.id.toString())) as Restaurant;
      expect(reloaded.visibility.value).toBe(CATALOG_VISIBILITY.PUBLIC);
    });
  });
});
