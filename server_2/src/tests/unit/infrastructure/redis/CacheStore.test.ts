import { CacheStore } from '../../../../infrastructure/redis/CacheStore';
import { RedisClient } from '../../../../infrastructure/redis/client';

function createMockRedisClient() {
  const client = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  return {
    redisClient: { getClient: () => client } as unknown as RedisClient,
    client,
  };
}

describe('CacheStore', () => {
  describe('get', () => {
    it('returns the parsed value on a cache hit', async () => {
      const { redisClient, client } = createMockRedisClient();
      client.get.mockResolvedValue(JSON.stringify({ id: 'restaurant-1' }));
      const store = new CacheStore(redisClient);

      const result = await store.get<{ id: string }>('cache:restaurant:restaurant-1');

      expect(result).toEqual({ id: 'restaurant-1' });
      expect(client.get).toHaveBeenCalledWith('cache:restaurant:restaurant-1');
    });

    it('returns null on a cache miss', async () => {
      const { redisClient, client } = createMockRedisClient();
      client.get.mockResolvedValue(null);
      const store = new CacheStore(redisClient);

      const result = await store.get('cache:restaurant:missing');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('stores the JSON-serialized value with a TTL when provided', async () => {
      const { redisClient, client } = createMockRedisClient();
      const store = new CacheStore(redisClient);

      await store.set('cache:restaurant:restaurant-1', { id: 'restaurant-1' }, 60);

      expect(client.set).toHaveBeenCalledWith(
        'cache:restaurant:restaurant-1',
        JSON.stringify({ id: 'restaurant-1' }),
        'EX',
        60,
      );
    });

    it('stores the JSON-serialized value without a TTL when omitted', async () => {
      const { redisClient, client } = createMockRedisClient();
      const store = new CacheStore(redisClient);

      await store.set('cache:restaurant:restaurant-1', { id: 'restaurant-1' });

      expect(client.set).toHaveBeenCalledWith('cache:restaurant:restaurant-1', JSON.stringify({ id: 'restaurant-1' }));
    });
  });

  describe('del / invalidate', () => {
    it('deletes the key via del', async () => {
      const { redisClient, client } = createMockRedisClient();
      const store = new CacheStore(redisClient);

      await store.del('cache:restaurant:restaurant-1');

      expect(client.del).toHaveBeenCalledWith('cache:restaurant:restaurant-1');
    });

    it('deletes the key via invalidate', async () => {
      const { redisClient, client } = createMockRedisClient();
      const store = new CacheStore(redisClient);

      await store.invalidate('cache:restaurant:restaurant-1');

      expect(client.del).toHaveBeenCalledWith('cache:restaurant:restaurant-1');
    });
  });

  describe('getOrSet', () => {
    it('returns the cached value without calling the loader on a hit', async () => {
      const { redisClient, client } = createMockRedisClient();
      client.get.mockResolvedValue(JSON.stringify({ id: 'restaurant-1' }));
      const store = new CacheStore(redisClient);
      const loader = jest.fn().mockResolvedValue({ id: 'should-not-be-used' });

      const result = await store.getOrSet('cache:restaurant:restaurant-1', 60, loader);

      expect(result).toEqual({ id: 'restaurant-1' });
      expect(loader).not.toHaveBeenCalled();
      expect(client.set).not.toHaveBeenCalled();
    });

    it('runs the loader and caches its result on a miss', async () => {
      const { redisClient, client } = createMockRedisClient();
      client.get.mockResolvedValue(null);
      const store = new CacheStore(redisClient);
      const loader = jest.fn().mockResolvedValue({ id: 'restaurant-1' });

      const result = await store.getOrSet('cache:restaurant:restaurant-1', 60, loader);

      expect(result).toEqual({ id: 'restaurant-1' });
      expect(loader).toHaveBeenCalledTimes(1);
      expect(client.set).toHaveBeenCalledWith(
        'cache:restaurant:restaurant-1',
        JSON.stringify({ id: 'restaurant-1' }),
        'EX',
        60,
      );
    });
  });
});
