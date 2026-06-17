import { StartedRedisContainer } from '@testcontainers/redis';
import { RedisClient } from '../../../infrastructure/redis/client';
import { OtpStore } from '../../../infrastructure/redis/OtpStore';
import { otpKey, otpAttemptsKey } from '../../../infrastructure/redis/keys';
import { startRedisContainer, StartedTestRedis } from './redis-container';

const TEST_TTL_SECONDS = 60;
const MAX_ATTEMPTS = 5;

describe('OtpStore', () => {
  let started: StartedTestRedis;
  let container: StartedRedisContainer;
  let client: RedisClient;
  let store: OtpStore;

  beforeAll(async () => {
    started = await startRedisContainer();
    container = started.container;
    client = new RedisClient(started.config);
    await client.connect();
    store = new OtpStore(client);
  });

  afterAll(async () => {
    await client.shutdown();
    await container.stop();
  });

  beforeEach(async () => {
    await client.getClient().flushall();
  });

  it('verifies successfully with the correct code after issue', async () => {
    await store.issue('email-verify:user-1', '123456', TEST_TTL_SECONDS);

    const result = await store.verify('email-verify:user-1', '123456');

    expect(result.isSuccess).toBe(true);
  });

  it('fails verification with the wrong code', async () => {
    await store.issue('email-verify:user-1', '123456', TEST_TTL_SECONDS);

    const result = await store.verify('email-verify:user-1', '000000');

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBe('OTP_INVALID');
  });

  it('allows the correct code after a wrong attempt, under the cap', async () => {
    await store.issue('email-verify:user-1', '123456', TEST_TTL_SECONDS);

    await store.verify('email-verify:user-1', 'wrong-code');
    const result = await store.verify('email-verify:user-1', '123456');

    expect(result.isSuccess).toBe(true);
  });

  it('fails as expired when no OTP was ever issued for the key', async () => {
    const result = await store.verify('email-verify:never-issued', '123456');

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBe('OTP_EXPIRED');
  });

  it('fails as expired once the caller-provided TTL elapses', async () => {
    await store.issue('email-verify:user-1', '123456', 1);
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const result = await store.verify('email-verify:user-1', '123456');

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBe('OTP_EXPIRED');
  });

  it('honors the caller-provided TTL on the otp key (not a hardcoded value)', async () => {
    await store.issue('email-verify:user-1', '123456', 120);

    const ttl = await client.getClient().ttl(otpKey('email-verify:user-1'));

    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(120);
  });

  it('locks out after 5 failed attempts, even with the correct code', async () => {
    await store.issue('email-verify:user-1', '123456', TEST_TTL_SECONDS);

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await store.verify('email-verify:user-1', 'wrong-code');
    }

    const result = await store.verify('email-verify:user-1', '123456');

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBe('OTP_MAX_ATTEMPTS');
  });

  it('sets a TTL on the attempt counter matching the otp TTL on the first failure', async () => {
    await store.issue('email-verify:user-1', '123456', TEST_TTL_SECONDS);
    await store.verify('email-verify:user-1', 'wrong-code');

    const ttl = await client.getClient().ttl(otpAttemptsKey('email-verify:user-1'));

    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(TEST_TTL_SECONDS);
  });

  it('resets the lockout when a fresh otp is issued', async () => {
    await store.issue('email-verify:user-1', '123456', TEST_TTL_SECONDS);
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await store.verify('email-verify:user-1', 'wrong-code');
    }

    await store.issue('email-verify:user-1', '654321', TEST_TTL_SECONDS);
    const result = await store.verify('email-verify:user-1', '654321');

    expect(result.isSuccess).toBe(true);
  });

  it('consume deletes the code and attempt counter; a later verify fails as expired', async () => {
    await store.issue('email-verify:user-1', '123456', TEST_TTL_SECONDS);
    await store.verify('email-verify:user-1', 'wrong-code');

    await store.consume('email-verify:user-1');

    expect(await client.getClient().exists(otpKey('email-verify:user-1'))).toBe(0);
    expect(await client.getClient().exists(otpAttemptsKey('email-verify:user-1'))).toBe(0);

    const result = await store.verify('email-verify:user-1', '123456');
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBe('OTP_EXPIRED');
  });

  it('treats the caller-supplied key as opaque, namespacing under otp: and rate:otp:', async () => {
    await store.issue('password-reset:user-42', '999999', TEST_TTL_SECONDS);

    expect(await client.getClient().get('otp:password-reset:user-42')).toBe('999999');
  });

  it('caps the failed-attempt counter at the limit under concurrent verification (Lua atomicity)', async () => {
    await store.issue('email-verify:concurrent-user', '123456', TEST_TTL_SECONDS);

    const results = await Promise.all(
      Array.from({ length: 10 }, () => store.verify('email-verify:concurrent-user', 'wrong-code')),
    );

    expect(results.every((r) => r.isFailure)).toBe(true);

    const counter = await client.getClient().get(otpAttemptsKey('email-verify:concurrent-user'));
    expect(Number(counter)).toBe(MAX_ATTEMPTS);

    const result = await store.verify('email-verify:concurrent-user', '123456');
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBe('OTP_MAX_ATTEMPTS');
  });
});
