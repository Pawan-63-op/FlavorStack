import { StartedRedisContainer } from '@testcontainers/redis';
import { RedisClient } from '../../../infrastructure/redis/client';
import { CacheStore } from '../../../infrastructure/redis/CacheStore';
import { startRedisContainer, StartedTestRedis } from './redis-container';

describe('CacheStore', () => {
  let started: StartedTestRedis;
  let container: StartedRedisContainer;
  let client: RedisClient;
  let store: CacheStore;

  beforeAll(async () => {
    started = await startRedisContainer();
    container = started.container;
    client = new RedisClient(started.config);
    await client.connect();
    store = new CacheStore(client);
  });

  afterAll(async () => {
    await client.shutdown();
    await container.stop();
  });

  beforeEach(async () => {
    await client.getClient().flushall();
  });

  it('returns null on a cache miss', async () => {
    const result = await store.get('cache:restaurant:missing');

    expect(result).toBeNull();
  });

  it('returns the typed value on a cache hit after set', async () => {
    await store.set('cache:restaurant:restaurant-1', { id: 'restaurant-1', name: 'Pizza Place' });

    const result = await store.get<{ id: string; name: string }>('cache:restaurant:restaurant-1');

    expect(result).toEqual({ id: 'restaurant-1', name: 'Pizza Place' });
  });

  it('expires the value after the given TTL', async () => {
    await store.set('cache:restaurant:restaurant-1', { id: 'restaurant-1' }, 1);
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const result = await store.get('cache:restaurant:restaurant-1');

    expect(result).toBeNull();
  });

  it('does not expire the value when no TTL is given', async () => {
    await store.set('cache:restaurant:restaurant-1', { id: 'restaurant-1' });

    const ttl = await client.getClient().ttl('cache:restaurant:restaurant-1');

    expect(ttl).toBe(-1);
  });

  it('removes the entry via del', async () => {
    await store.set('cache:restaurant:restaurant-1', { id: 'restaurant-1' });

    await store.del('cache:restaurant:restaurant-1');

    expect(await store.get('cache:restaurant:restaurant-1')).toBeNull();
  });

  it('removes the entry via invalidate', async () => {
    await store.set('cache:restaurant:restaurant-1', { id: 'restaurant-1' });

    await store.invalidate('cache:restaurant:restaurant-1');

    expect(await store.get('cache:restaurant:restaurant-1')).toBeNull();
  });

  it('getOrSet runs the loader once on a miss and caches the result', async () => {
    const loader = jest.fn().mockResolvedValue({ id: 'restaurant-1' });

    const first = await store.getOrSet('cache:restaurant:restaurant-1', 60, loader);
    const second = await store.getOrSet('cache:restaurant:restaurant-1', 60, loader);

    expect(first).toEqual({ id: 'restaurant-1' });
    expect(second).toEqual({ id: 'restaurant-1' });
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
