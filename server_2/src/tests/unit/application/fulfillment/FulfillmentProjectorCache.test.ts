import { randomUUID } from 'crypto';
import { DomainEvent } from '../../../../domain/shared/DomainEvent';
import { FulfillmentProjector } from '../../../../application/fulfillment/projector/FulfillmentProjector';
import { IFulfillmentProjectionRepository } from '../../../../domain/fulfillment/repositories/IFulfillmentProjectionRepository';
import { IFulfillmentCacheInvalidator } from '../../../../domain/fulfillment/services/IFulfillmentCache';

function makeRepo(): jest.Mocked<IFulfillmentProjectionRepository> {
  return {
    upsertCustomerTracking: jest.fn().mockResolvedValue(undefined),
    findCustomerTracking: jest.fn().mockResolvedValue({ restaurantId: 'rest-1', deliveryAddress: {}, total: {}, currentStatus: 'PREPARING' }),
    findByCustomer: jest.fn().mockResolvedValue([]),
    upsertRestaurantView: jest.fn().mockResolvedValue(undefined),
    removeRestaurantView: jest.fn().mockResolvedValue(undefined),
    findRestaurantQueue: jest.fn().mockResolvedValue([]),
    upsertRiderQueueItem: jest.fn().mockResolvedValue(undefined),
    removeRiderQueueItem: jest.fn().mockResolvedValue(undefined),
    removeAllRiderQueueItemsForFulfillment: jest.fn().mockResolvedValue(undefined),
    findRiderQueue: jest.fn().mockResolvedValue([]),
    findRiderCompletedDeliveries: jest.fn().mockResolvedValue([]),
    upsertAdminView: jest.fn().mockResolvedValue(undefined),
    patchAdminView: jest.fn().mockResolvedValue(undefined),
    findAdminDashboard: jest.fn().mockResolvedValue([]),
    aggregateAnalytics: jest.fn(),
  };
}

function evt(name: string, aggregateId: string, extra: Record<string, unknown> = {}): DomainEvent {
  return { eventId: randomUUID(), occurredOn: new Date(), eventName: name, aggregateId, ...extra } as DomainEvent;
}

const FID = 'f-1';

describe('FulfillmentProjector cache invalidation', () => {
  let repo: jest.Mocked<IFulfillmentProjectionRepository>;
  let invalidator: jest.Mocked<IFulfillmentCacheInvalidator>;
  let projector: FulfillmentProjector;

  beforeEach(() => {
    repo = makeRepo();
    invalidator = { invalidateFulfillment: jest.fn().mockResolvedValue(undefined) };
    projector = new FulfillmentProjector(repo, invalidator);
  });

  it('invalidates after a status-mutating event (PreparationStarted)', async () => {
    await projector.onPreparationStarted(evt('PreparationStarted', FID, { restaurantId: 'rest-1' }));
    expect(invalidator.invalidateFulfillment).toHaveBeenCalledWith(FID);
  });

  it('invalidates on a terminal event (FulfillmentCancelled)', async () => {
    await projector.onFulfillmentCancelled(
      evt('FulfillmentCancelled', FID, { cancelledBy: 'CUSTOMER', reason: 'x', refundHint: { total: { amount: 0, currency: 'INR' } } })
    );
    expect(invalidator.invalidateFulfillment).toHaveBeenCalledWith(FID);
  });

  it('invalidates AFTER the projection write is applied (ordering guarantee)', async () => {
    const calls: string[] = [];
    repo.patchAdminView.mockImplementation(async () => {
      calls.push('write');
    });
    invalidator.invalidateFulfillment.mockImplementation(async () => {
      calls.push('invalidate');
    });

    await projector.onOutForDelivery(evt('OutForDelivery', FID, { riderId: 'rider-1' }));

    expect(calls).toEqual(['write', 'invalidate']);
  });

  it('does NOT invalidate for rider-queue-only events (RiderOffered)', async () => {
    await projector.onRiderOffered(evt('RiderOffered', FID, { riderId: 'rider-1', attempt: 1, expiresAt: new Date() }));
    expect(invalidator.invalidateFulfillment).not.toHaveBeenCalled();
  });

  it('is a no-op when no invalidator is wired', async () => {
    const plain = new FulfillmentProjector(repo);
    await expect(
      plain.onPreparationStarted(evt('PreparationStarted', FID, { restaurantId: 'rest-1' }))
    ).resolves.toBeUndefined();
  });
});
