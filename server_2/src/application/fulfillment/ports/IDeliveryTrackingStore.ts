import { RiderLocationSnapshot } from './RiderLocationSnapshot';

export interface IDeliveryTrackingStore {
  /** Appends one GPS sample. Called only when the throttle gate (ILiveLocationStore) opens. */
  append(snapshot: RiderLocationSnapshot): Promise<void>;
}
