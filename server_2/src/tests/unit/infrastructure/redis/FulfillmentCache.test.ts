import { CacheStore } from '../../../../infrastructure/redis/CacheStore';
import { FulfillmentCache } from '../../../../infrastructure/redis/fulfillment/FulfillmentCache';

class FakeRedis {
  private store = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  async set(key: string, value: string): Promise<'OK'> {
    this.store.set(key, value);
    return 'OK';
  }
  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }
  async incr(key: string): Promise<number> {
    const next = Number(this.store.get(key) ?? '0') + 1;
    this.store.set(key, String(next));
    return next;
  }
}

function makeCache(): { cache: FulfillmentCache; redis: FakeRedis } {
  const redis = new FakeRedis();
  const cacheStore = new CacheStore({ getClient: () => redis } as never);
  const cache = new FulfillmentCache(cacheStore, { trackingSeconds: 30, dashboardSeconds: 15 });
  return { cache, redis };
}

describe('FulfillmentCache', () => {
  describe('rememberTracking', () => {
    it('loads on miss then serves the cached value without re-loading', async () => {
      const { cache } = makeCache();
      const loader = jest.fn().mockResolvedValue({ fulfillmentId: 'f-1', currentStatus: 'PREPARING' });

      const first = await cache.rememberTracking('f-1', loader);
      const second = await cache.rememberTracking('f-1', loader);

      expect(first).toEqual({ fulfillmentId: 'f-1', currentStatus: 'PREPARING' });
      expect(second).toEqual(first);
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it('re-loads after invalidateFulfillment drops the key', async () => {
      const { cache } = makeCache();
      const loader = jest
        .fn()
        .mockResolvedValueOnce({ currentStatus: 'PREPARING' })
        .mockResolvedValueOnce({ currentStatus: 'OUT_FOR_DELIVERY' });

      await cache.rememberTracking('f-1', loader);
      await cache.invalidateFulfillment('f-1');
      const after = await cache.rememberTracking('f-1', loader);

      expect(after).toEqual({ currentStatus: 'OUT_FOR_DELIVERY' });
      expect(loader).toHaveBeenCalledTimes(2);
    });

    it('isolates keys per fulfillmentId', async () => {
      const { cache } = makeCache();
      await cache.rememberTracking('f-1', async () => ({ id: 'f-1' }));
      const loader2 = jest.fn().mockResolvedValue({ id: 'f-2' });

      const result = await cache.rememberTracking('f-2', loader2);

      expect(result).toEqual({ id: 'f-2' });
      expect(loader2).toHaveBeenCalledTimes(1);
    });
  });

  describe('rememberDashboard', () => {
    it('caches per discriminator and serves hits', async () => {
      const { cache } = makeCache();
      const loader = jest.fn().mockResolvedValue([{ fulfillmentId: 'f-1' }]);

      await cache.rememberDashboard('status=PREPARING', loader);
      await cache.rememberDashboard('status=PREPARING', loader);

      expect(loader).toHaveBeenCalledTimes(1);
    });

    it('rotates the whole dashboard on invalidateFulfillment (generation bump)', async () => {
      const { cache } = makeCache();
      const loader = jest
        .fn()
        .mockResolvedValueOnce([{ status: 'PREPARING' }])
        .mockResolvedValueOnce([{ status: 'READY_FOR_PICKUP' }]);

      await cache.rememberDashboard('status=', loader);
      await cache.invalidateFulfillment('some-other-fulfillment');
      const after = await cache.rememberDashboard('status=', loader);

      expect(after).toEqual([{ status: 'READY_FOR_PICKUP' }]);
      expect(loader).toHaveBeenCalledTimes(2);
    });
  });
});
