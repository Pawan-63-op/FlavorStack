import { getAuthConfig } from './auth';
import { getEmailConfig } from './email';
import { getRedisConfig } from './redis';

export * from './auth';
export * from './email';
export * from './outbox';
export * from './fulfillment';

export function assertRequiredConfig(): void {
  const auth = getAuthConfig();
  const email = getEmailConfig();
  const missing: string[] = [];

  if (!auth.jwtPrivateKey) missing.push('JWT_PRIVATE_KEY (or JWT_PRIVATE_KEY_PATH)');
  if (!auth.jwtPublicKey) missing.push('JWT_PUBLIC_KEY (or JWT_PUBLIC_KEY_PATH)');
  if (!email.apiKey) missing.push('RESEND_API_KEY');

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

/**
 * Workers never mint or verify tokens; they need storage only. `assertRequiredConfig()` would
 * over-assert on the JWT key pair (and on Resend, which only the jobs profile's email worker
 * needs — `assertEmailWorkerConfig()` in `worker.container.ts` is that gate).
 */
export function assertWorkerConfig(): void {
  const redis = getRedisConfig();
  const missing: string[] = [];

  if (!process.env.MONGO_URI) missing.push('MONGO_URI');
  if (!redis.host) missing.push('REDIS_HOST');
  if (!Number.isFinite(redis.port)) missing.push('REDIS_PORT');

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
