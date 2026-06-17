// Port for the rider's latest-location store + throttle gate (fulfillment_module.md §9, Phase 7).
// Implemented by infrastructure/realtime/RedisLiveLocationStore (Redis: O(1) latest read + a
// distributed, multi-instance-safe throttle gate so Mongo persistence stays write-light).
import { RiderLocationSnapshot } from './RiderLocationSnapshot';

export interface ILiveLocationStore {
  /** Overwrites the latest known location for a fulfillment (cheap, every ping). */
  setLatest(snapshot: RiderLocationSnapshot): Promise<void>;

  /** O(1) read of the latest location for a fulfillment, or null if none recorded yet. */
  getLatest(fulfillmentId: string): Promise<RiderLocationSnapshot | null>;

  /**
   * Throttle gate for the write-light Mongo persistence path. Returns `true` at most once per
   * `throttleSeconds` window per fulfillment, across ALL instances (a Redis SET NX EX), so a
   * fleet of API nodes still persists ~1 row / window rather than 1 / ping.
   */
  tryAcquirePersistSlot(fulfillmentId: string, throttleSeconds: number): Promise<boolean>;
}
