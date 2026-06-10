// Redis connection config (host, port, password, TLS)
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  tls?: boolean;
  keyPrefix?: string;
  connectTimeoutMs: number;
  maxRetriesPerRequest: number;
}

export function getRedisConfig(): RedisConfig {
  return {
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: process.env.REDIS_DB !== undefined ? Number(process.env.REDIS_DB) : undefined,
    tls: process.env.REDIS_TLS === 'true',
    keyPrefix: process.env.REDIS_KEY_PREFIX || undefined,
    connectTimeoutMs: Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? 10000),
    maxRetriesPerRequest: Number(process.env.REDIS_MAX_RETRIES_PER_REQUEST ?? 3),
  };
}
