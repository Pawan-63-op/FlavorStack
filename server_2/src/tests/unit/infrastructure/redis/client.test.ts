import { RedisClient } from '../../../../infrastructure/redis/client';

describe('RedisClient (construction)', () => {
  it('does not connect eagerly (lazyConnect) and is not ready', () => {
    const client = new RedisClient({
      host: '127.0.0.1',
      port: 6379,
      connectTimeoutMs: 1000,
      maxRetriesPerRequest: 1,
    });

    expect(client.isReady()).toBe(false);
    expect(client.getClient().status).toBe('wait');

    client.getClient().disconnect();
  });
});
