// Port for the throttled, write-light GPS history store (fulfillment_module.md §8.1 / §9, Phase 7).
// Implemented by infrastructure/repositories/DeliveryTrackingStore (Mongo `delivery_tracking`
// collection with a TTL index). NOT the aggregate — pings never touch `fulfillments`.
import { RiderLocationSnapshot } from './RiderLocationSnapshot';

export interface IDeliveryTrackingStore {
  /** Appends one GPS sample. Called only when the throttle gate (ILiveLocationStore) opens. */
  append(snapshot: RiderLocationSnapshot): Promise<void>;
}
