import { randomUUID } from 'crypto';
import { DomainEvent } from '../../../../domain/shared/DomainEvent';
import { FulfillmentProjector } from '../../../../application/fulfillment/projector/FulfillmentProjector';
import { ICustomerTrackingRepository } from '../../../../domain/fulfillment/repositories/ICustomerTrackingRepository';
import { IFulfillmentCacheInvalidator } from '../../../../domain/fulfillment/services/IFulfillmentCache';

function makeRepo(): jest.Mocked<ICustomerTrackingRepository> {
  return {
    upsertCustomerTracking: jest.fn().mockResolvedValue(undefined),
    findCustomerTracking: jest.fn().mockResolvedValue({ restaurantId: 'rest-1', deliveryAddress: {}, total: {}, currentStatus: 'PREPARING' }),
    findByCustomer: jest.fn().mockResolvedValue([]),
  };
}

function evt(name: string, aggregateId: string, extra: Record<string, unknown> = {}): DomainEvent {
  return { eventId: randomUUID(), occurredOn: new Date(), eventName: name, aggregateId, ...extra } as DomainEvent;
}

const FID = 'f-1';

describe('FulfillmentProjector cache invalidation', () => {
  let repo: jest.Mocked<ICustomerTrackingRepository>;
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
    repo.upsertCustomerTracking.mockImplementation(async () => {
      calls.push('write');
    });
    invalidator.invalidateFulfillment.mockImplementation(async () => {
      calls.push('invalidate');
    });

    await projector.onOutForDelivery(evt('OutForDelivery', FID, { riderId: 'rider-1' }));

    expect(calls).toEqual(['write', 'invalidate']);
  });

  it.each([
    ['onFulfillmentCreated', 'FulfillmentCreated', { orderRequestId: 'or-1', customerId: 'c-1', restaurantId: 'rest-1', total: { amount: 1, currency: 'INR' } }],
    ['onReadyForPickup', 'ReadyForPickup', { restaurantId: 'rest-1', readyAt: new Date() }],
    ['onRiderAssigned', 'RiderAssigned', { riderId: 'rider-1', assignedAt: new Date() }],
    ['onPickupConfirmed', 'PickupConfirmed', { riderId: 'rider-1', pickedUpAt: new Date() }],
    ['onOutForDelivery', 'OutForDelivery', { riderId: 'rider-1' }],
    ['onDeliveryCompleted', 'DeliveryCompleted', { riderId: 'rider-1', deliveredAt: new Date() }],
    ['onDeliveryFailed', 'DeliveryFailed', { riderId: 'rider-1', failureReason: 'x' }],
    ['onRiderReassigned', 'RiderReassigned', { previousRiderId: 'rider-1', newRiderId: 'rider-2', attempt: 2 }],
  ] as const)(
    'still invalidates on %s after the Batch 5 reduction',
    async (handler, eventName, payload) => {
      await (projector[handler] as (e: DomainEvent) => Promise<void>)(evt(eventName, FID, payload));
      expect(invalidator.invalidateFulfillment).toHaveBeenCalledWith(FID);
    }
  );

  it('is a no-op when no invalidator is wired', async () => {
    const plain = new FulfillmentProjector(repo);
    await expect(
      plain.onPreparationStarted(evt('PreparationStarted', FID, { restaurantId: 'rest-1' }))
    ).resolves.toBeUndefined();
  });
});
