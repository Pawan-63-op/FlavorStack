// CacheStore — generic cache-aside abstraction over Redis (get/set/del/invalidate/getOrSet, JSON-serialized, optional TTL)
import { RedisClient } from './client';

export class CacheStore {
  constructor(private readonly redisClient: RedisClient) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redisClient.getClient().get(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds !== undefined) {
      await this.redisClient.getClient().set(key, serialized, 'EX', ttlSeconds);
    } else {
      await this.redisClient.getClient().set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.redisClient.getClient().del(key);
  }

  async invalidate(key: string): Promise<void> {
    await this.del(key);
  }

  async getOrSet<T>(key: string, ttlSeconds: number | undefined, loader: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await loader();
    await this.set(key, value, ttlSeconds);
    return value;
  }
}
