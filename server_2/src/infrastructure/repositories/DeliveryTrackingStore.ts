// MongoDeliveryTrackingStore — implements IDeliveryTrackingStore (fulfillment_module.md §8.1 / §9,
// Phase 7). Session-less, append-only writes to `delivery_tracking` (a throttle gate upstream
// already bounds volume). Not the aggregate — GPS never participates in fulfillment transactions.
import { IDeliveryTrackingStore } from '../../application/fulfillment/ports/IDeliveryTrackingStore';
import { RiderLocationSnapshot } from '../../application/fulfillment/ports/RiderLocationSnapshot';
import { DeliveryTrackingModel } from '../database/models/DeliveryTrackingModel';

export class MongoDeliveryTrackingStore implements IDeliveryTrackingStore {
  async append(snapshot: RiderLocationSnapshot): Promise<void> {
    await DeliveryTrackingModel.create({
      fulfillmentId: snapshot.fulfillmentId,
      riderId: snapshot.riderId,
      lat: snapshot.lat,
      lng: snapshot.lng,
      recordedAt: snapshot.recordedAt,
    });
  }
}
