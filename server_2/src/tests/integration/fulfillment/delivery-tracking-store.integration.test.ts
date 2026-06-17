// Integration test for MongoDeliveryTrackingStore (Phase 7) against a real Mongo (via setup.ts).
// Verifies append writes to `delivery_tracking` and that the TTL index exists (self-pruning).
import { MongoDeliveryTrackingStore } from '../../../infrastructure/repositories/DeliveryTrackingStore';
import { DeliveryTrackingModel } from '../../../infrastructure/database/models/DeliveryTrackingModel';

describe('MongoDeliveryTrackingStore (Phase 7)', () => {
  const store = new MongoDeliveryTrackingStore();

  beforeEach(async () => {
    await DeliveryTrackingModel.deleteMany({});
  });

  afterAll(async () => {
    await DeliveryTrackingModel.deleteMany({});
  });

  it('appends a GPS sample to delivery_tracking', async () => {
    const recordedAt = new Date();
    await store.append({ fulfillmentId: 'ful-1', riderId: 'rider-1', lat: 12.97, lng: 77.59, recordedAt });

    const rows = await DeliveryTrackingModel.find({ fulfillmentId: 'ful-1' }).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ riderId: 'rider-1', lat: 12.97, lng: 77.59 });
  });

  it('appends multiple samples newest-first by recordedAt', async () => {
    const base = Date.now();
    await store.append({ fulfillmentId: 'ful-2', riderId: 'r', lat: 1, lng: 1, recordedAt: new Date(base) });
    await store.append({ fulfillmentId: 'ful-2', riderId: 'r', lat: 2, lng: 2, recordedAt: new Date(base + 1000) });

    const rows = await DeliveryTrackingModel.find({ fulfillmentId: 'ful-2' }).sort({ recordedAt: -1 }).lean();
    expect(rows.map((r) => r.lat)).toEqual([2, 1]);
  });

  it('declares a TTL index on recordedAt so samples self-expire', async () => {
    await DeliveryTrackingModel.init(); // ensure indexes are built
    const indexes = await DeliveryTrackingModel.collection.indexes();
    const ttlIndex = indexes.find((i) => i.key?.recordedAt === 1 && i.expireAfterSeconds !== undefined);
    expect(ttlIndex).toBeDefined();
  });
});
