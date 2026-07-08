import { StartedRedisContainer } from '@testcontainers/redis';
import { RedisClient } from '../../../infrastructure/redis/client';
import { RedisLiveLocationStore } from '../../../infrastructure/realtime/RedisLiveLocationStore';
import { RiderLocationSnapshot } from '../../../application/fulfillment/ports/RiderLocationSnapshot';
import { startRedisContainer, StartedTestRedis } from './redis-container';

const LATEST_TTL = 3600;

function snap(fulfillmentId: string): RiderLocationSnapshot {
  return { fulfillmentId, riderId: 'rider-1', lat: 12.97, lng: 77.59, recordedAt: new Date() };
}

describe('RedisLiveLocationStore', () => {
  let started: StartedTestRedis;
  let container: StartedRedisContainer;
  let client: RedisClient;
  let store: RedisLiveLocationStore;

  beforeAll(async () => {
    started = await startRedisContainer();
    container = started.container;
    client = new RedisClient(started.config);
    await client.connect();
    store = new RedisLiveLocationStore(client, LATEST_TTL);
  });

  afterAll(async () => {
    await client.shutdown();
    await container.stop();
  });

  beforeEach(async () => {
    await client.getClient().flushall();
  });

  it('returns null on a miss', async () => {
    expect(await store.getLatest('ful-missing')).toBeNull();
  });

  it('round-trips the latest location', async () => {
    const s = snap('ful-1');
    await store.setLatest(s);

    const got = await store.getLatest('ful-1');
    expect(got).not.toBeNull();
    expect(got!).toMatchObject({ fulfillmentId: 'ful-1', riderId: 'rider-1', lat: 12.97, lng: 77.59 });
    expect(got!.recordedAt.toISOString()).toBe(s.recordedAt.toISOString());
  });

  it('overwrites the latest location on each set', async () => {
    await store.setLatest({ ...snap('ful-2'), lat: 1, lng: 1 });
    await store.setLatest({ ...snap('ful-2'), lat: 2, lng: 2 });

    const got = await store.getLatest('ful-2');
    expect(got).toMatchObject({ lat: 2, lng: 2 });
  });

  it('sets a TTL on the latest-location key', async () => {
    await store.setLatest(snap('ful-3'));
    const ttl = await client.getClient().ttl('tracking:latest:ful-3');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(LATEST_TTL);
  });

  it('opens the persist gate once per window (distributed throttle)', async () => {
    const first = await store.tryAcquirePersistSlot('ful-4', 60);
    const second = await store.tryAcquirePersistSlot('ful-4', 60);
    const otherFulfillment = await store.tryAcquirePersistSlot('ful-5', 60);

    expect(first).toBe(true);
    expect(second).toBe(false); // gate held within the window
    expect(otherFulfillment).toBe(true); // independent per fulfillment
  });

  it('reopens the persist gate after the window expires', async () => {
    expect(await store.tryAcquirePersistSlot('ful-6', 1)).toBe(true);
    expect(await store.tryAcquirePersistSlot('ful-6', 1)).toBe(false);
    await new Promise((r) => setTimeout(r, 1100));
    expect(await store.tryAcquirePersistSlot('ful-6', 1)).toBe(true);
  });
});
