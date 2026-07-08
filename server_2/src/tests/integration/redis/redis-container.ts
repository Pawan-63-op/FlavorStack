import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { RedisConfig } from '../../../config/redis';

const REDIS_IMAGE = 'redis:7-alpine';

export interface StartedTestRedis {
  container: StartedRedisContainer;
  config: RedisConfig;
}

export async function startRedisContainer(): Promise<StartedTestRedis> {
  const container = await new RedisContainer(REDIS_IMAGE).start();

  const config: RedisConfig = {
    host: container.getHost(),
    port: container.getPort(),
    connectTimeoutMs: 10000,
    maxRetriesPerRequest: 3,
  };

  return { container, config };
}
