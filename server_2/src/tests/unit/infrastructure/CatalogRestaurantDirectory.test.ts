import { CatalogRestaurantDirectory } from '../../../infrastructure/services/CatalogRestaurantDirectory';
import { IRestaurantRepository } from '../../../domain/catalog/repositories/IRestaurantRepository';
import { Restaurant } from '../../../domain/catalog/entities/Restaurant';

/** Minimal Restaurant stand-in: only the fields the directory adapter reads. */
function fakeRestaurant(id: string, ownerId = 'owner-1', name = `Name ${id}`): Restaurant {
  return { id: { toString: () => id }, ownerId, name } as unknown as Restaurant;
}

function makeRepo(
  overrides: Partial<jest.Mocked<IRestaurantRepository>> = {}
): jest.Mocked<IRestaurantRepository> {
  return {
    save: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    findById: jest.fn(),
    findBySlug: jest.fn(),
    findByOwner: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn(),
    ...overrides,
  } as unknown as jest.Mocked<IRestaurantRepository>;
}

describe('CatalogRestaurantDirectory', () => {
  describe('getOwnerId', () => {
    it("returns the restaurant's ownerId", async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue({ ownerId: 'owner-1' }) });
      const directory = new CatalogRestaurantDirectory(repo);

      const ownerId = await directory.getOwnerId('rest-1');

      expect(ownerId).toBe('owner-1');
      expect(repo.findById).toHaveBeenCalledWith('rest-1');
    });

    it('returns null when the restaurant is not found', async () => {
      const directory = new CatalogRestaurantDirectory(
        makeRepo({ findById: jest.fn().mockResolvedValue(null) })
      );

      expect(await directory.getOwnerId('missing')).toBeNull();
    });
  });

  describe('listRestaurantIdsByOwner', () => {
    it('returns the ids for a single page', async () => {
      const findByOwner = jest
        .fn()
        .mockResolvedValue({ items: [fakeRestaurant('r1'), fakeRestaurant('r2')], nextCursor: undefined });
      const directory = new CatalogRestaurantDirectory(makeRepo({ findByOwner }));

      expect(await directory.listRestaurantIdsByOwner('owner-1')).toEqual(['r1', 'r2']);
      expect(findByOwner).toHaveBeenCalledWith('owner-1', { cursor: undefined });
    });

    it('pages through every cursor until exhausted', async () => {
      const findByOwner = jest
        .fn()
        .mockResolvedValueOnce({ items: [fakeRestaurant('r1')], nextCursor: 'c1' })
        .mockResolvedValueOnce({ items: [fakeRestaurant('r2')], nextCursor: undefined });
      const directory = new CatalogRestaurantDirectory(makeRepo({ findByOwner }));

      expect(await directory.listRestaurantIdsByOwner('owner-1')).toEqual(['r1', 'r2']);
      expect(findByOwner).toHaveBeenNthCalledWith(2, 'owner-1', { cursor: 'c1' });
    });

    it('returns an empty array when the owner has no restaurants', async () => {
      const findByOwner = jest.fn().mockResolvedValue({ items: [], nextCursor: undefined });
      const directory = new CatalogRestaurantDirectory(makeRepo({ findByOwner }));

      expect(await directory.listRestaurantIdsByOwner('owner-x')).toEqual([]);
    });
  });

  describe('getRestaurantNames', () => {
    it('maps found restaurant ids to names and skips missing ones', async () => {
      const findById = jest.fn(async (id: string) =>
        id === 'r1' ? fakeRestaurant('r1', 'owner-1', 'Demo Diner') : null
      );
      const directory = new CatalogRestaurantDirectory(makeRepo({ findById }));

      expect(await directory.getRestaurantNames(['r1', 'r2'])).toEqual({ r1: 'Demo Diner' });
    });

    it('returns an empty map for empty input without hitting the repo', async () => {
      const findById = jest.fn();
      const directory = new CatalogRestaurantDirectory(makeRepo({ findById }));

      expect(await directory.getRestaurantNames([])).toEqual({});
      expect(findById).not.toHaveBeenCalled();
    });
  });

  describe('countAll', () => {
    it('delegates to the repository count', async () => {
      const count = jest.fn().mockResolvedValue(7);
      const directory = new CatalogRestaurantDirectory(makeRepo({ count }));

      expect(await directory.countAll()).toBe(7);
    });
  });
});
