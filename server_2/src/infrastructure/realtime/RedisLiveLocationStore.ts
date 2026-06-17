// RedisLiveLocationStore — implements ILiveLocationStore (fulfillment_module.md §9, Phase 7).
//
//  - setLatest:  one `SET key value EX ttl` per ping → O(1) latest-location read.
//  - getLatest:  one `GET` + JSON parse.
//  - tryAcquirePersistSlot: a distributed throttle via `SET key 1 EX n NX`. Because Redis is shared
//    across instances, only ONE node wins the slot per window → Mongo persistence stays write-light
//    even with a fleet of API nodes all receiving pings for the same fulfillment (§8.1).
import { Redis } from 'ioredis';
import { RedisClient } from '../redis/client';
import { trackingLatestKey, trackingPersistGateKey } from '../redis/keys';
import { ILiveLocationStore } from '../../application/fulfillment/ports/ILiveLocationStore';
import { RiderLocationSnapshot } from '../../application/fulfillment/ports/RiderLocationSnapshot';

interface StoredLocation {
  riderId: string;
  lat: number;
  lng: number;
  recordedAt: string; // ISO-8601
}

export class RedisLiveLocationStore implements ILiveLocationStore {
  private readonly client: Redis;

  constructor(
    redisClient: RedisClient,
    private readonly latestTtlSeconds: number
  ) {
    this.client = redisClient.getClient();
  }

  async setLatest(snapshot: RiderLocationSnapshot): Promise<void> {
    const payload: StoredLocation = {
      riderId: snapshot.riderId,
      lat: snapshot.lat,
      lng: snapshot.lng,
      recordedAt: snapshot.recordedAt.toISOString(),
    };
    await this.client.set(
      trackingLatestKey(snapshot.fulfillmentId),
      JSON.stringify(payload),
      'EX',
      this.latestTtlSeconds
    );
  }

  async getLatest(fulfillmentId: string): Promise<RiderLocationSnapshot | null> {
    const raw = await this.client.get(trackingLatestKey(fulfillmentId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredLocation;
    return {
      fulfillmentId,
      riderId: parsed.riderId,
      lat: parsed.lat,
      lng: parsed.lng,
      recordedAt: new Date(parsed.recordedAt),
    };
  }

  async tryAcquirePersistSlot(fulfillmentId: string, throttleSeconds: number): Promise<boolean> {
    // NX => only set if absent; the key auto-expires after `throttleSeconds`, reopening the gate.
    const reply = await this.client.set(
      trackingPersistGateKey(fulfillmentId),
      '1',
      'EX',
      throttleSeconds,
      'NX'
    );
    return reply === 'OK';
  }
}
