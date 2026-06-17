import { StartedRedisContainer } from '@testcontainers/redis';
import { RedisClient } from '../../../infrastructure/redis/client';
import { startRedisContainer, StartedTestRedis } from './redis-container';

describe('RedisClient', () => {
  let started: StartedTestRedis;
  let container: StartedRedisContainer;
  let client: RedisClient;

  beforeAll(async () => {
    started = await startRedisContainer();
    container = started.container;
    client = new RedisClient(started.config);
  });

  afterAll(async () => {
    await container.stop();
  });

  it('is not ready before connect()', () => {
    expect(client.isReady()).toBe(false);
  });

  it('connects and becomes ready', async () => {
    await client.connect();
    expect(client.isReady()).toBe(true);
  });

  it('responds to ping() once connected', async () => {
    await expect(client.ping()).resolves.toBe(true);
  });

  it('is not ready after shutdown()', async () => {
    await client.shutdown();
    expect(client.isReady()).toBe(false);
  });

  it('rejects connect() when the server is unreachable', async () => {
    const unreachable = new RedisClient({
      host: '127.0.0.1',
      port: 1,
      connectTimeoutMs: 1000,
      maxRetriesPerRequest: 1,
    });

    await expect(unreachable.connect()).rejects.toThrow();
    expect(unreachable.isReady()).toBe(false);

    unreachable.getClient().disconnect();
  });
});
