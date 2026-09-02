import { randomUUID } from 'crypto';
import { DomainEvent } from '../../../../domain/shared/DomainEvent';
import { FulfillmentProjector } from '../../../../application/fulfillment/projector/FulfillmentProjector';
import {
  ICustomerTrackingRepository,
  CustomerTrackingView,
} from '../../../../domain/fulfillment/repositories/ICustomerTrackingRepository';
import {
  RiderQueueView as QueryRiderQueueView,
  AdminDashboardView as QueryAdminDashboardView,
} from '../../../../domain/fulfillment/repositories/IFulfillmentQueryRepository';
// Read-side port (Phase 3) — rider and admin reads no longer go through the projection.
import { makeQueryRepo } from '../../../mocks/fulfillment.mocks';
import { registerFulfillmentProjector } from '../../../../application/fulfillment/projector/FulfillmentProjectionRegistry';
import { IEventBus } from '../../../../application/shared/events/IEventBus';

function makeRepo(): jest.Mocked<ICustomerTrackingRepository> {
  return {
    upsertCustomerTracking: jest.fn().mockResolvedValue(undefined),
    findCustomerTracking: jest.fn().mockResolvedValue(null),
    findByCustomer: jest.fn().mockResolvedValue([]),
  };
}

function evt(name: string, aggregateId: string, extra: Record<string, unknown> = {}): DomainEvent {
  return {
    eventId: randomUUID(),
    occurredOn: new Date(),
    eventName: name,
    aggregateId,
    ...extra,
  } as DomainEvent;
}

const FULFILLMENT_ID = 'f-1';
const CUSTOMER_ID = 'cust-1';
const RESTAURANT_ID = 'rest-1';
const RIDER_ID = 'rider-1';
const TOTAL = { amount: 45000, currency: 'INR' };
const ADDRESS = {
  street: '12 MG Road',
  city: 'Bengaluru',
  state: 'Karnataka',
  pinCode: '560001',
  coordinates: { lat: 12.97, lng: 77.59 },
};


describe('FulfillmentProjector', () => {
  let repo: jest.Mocked<ICustomerTrackingRepository>;
  let projector: FulfillmentProjector;

  beforeEach(() => {
    repo = makeRepo();
    projector = new FulfillmentProjector(repo);
  });

  describe('onFulfillmentCreated', () => {
    it('seeds the CustomerTrackingView', async () => {
      const event = evt('FulfillmentCreated', FULFILLMENT_ID, {
        orderRequestId: 'or-1',
        customerId: CUSTOMER_ID,
        restaurantId: RESTAURANT_ID,
        total: TOTAL,
        lines: [{ menuItemId: 'i1', name: 'Paneer Tikka', quantity: 1, lineTotal: TOTAL }],
        deliveryAddress: ADDRESS,
      });

      await projector.onFulfillmentCreated(event);

      expect(repo.upsertCustomerTracking).toHaveBeenCalledTimes(1);
      const ctArgs = repo.upsertCustomerTracking.mock.calls[0][0];
      expect(ctArgs.fulfillmentId).toBe(FULFILLMENT_ID);
      expect(ctArgs.set.currentStatus).toBe('CREATED');
      expect(ctArgs.timelineEntry.status).toBe('CREATED');
      expect(ctArgs.set.customerId).toBe(CUSTOMER_ID);
      expect(ctArgs.set.restaurantId).toBe(RESTAURANT_ID);
    });
  });

  describe('onPreparationStarted', () => {
    it('updates CustomerTracking to PREPARING', async () => {
      await projector.onPreparationStarted(
        evt('PreparationStarted', FULFILLMENT_ID, { restaurantId: RESTAURANT_ID, prepEstimateMinutes: 15 })
      );

      expect(repo.upsertCustomerTracking).toHaveBeenCalledTimes(1);
      expect(repo.upsertCustomerTracking.mock.calls[0][0].set.currentStatus).toBe('PREPARING');
    });
  });

  describe('onReadyForPickup', () => {
    it('updates CustomerTracking and stamps the timeline entry at readyAt', async () => {
      const readyAt = new Date();

      await projector.onReadyForPickup(
        evt('ReadyForPickup', FULFILLMENT_ID, { restaurantId: RESTAURANT_ID, readyAt })
      );

      expect(repo.upsertCustomerTracking.mock.calls[0][0].set.currentStatus).toBe('READY_FOR_PICKUP');
      expect(repo.upsertCustomerTracking.mock.calls[0][0].timelineEntry.at).toBe(readyAt);
    });
  });

  describe('onRiderAssigned', () => {
    it('records the rider and the ASSIGNED delivery status on the tracking view', async () => {
      const assignedAt = new Date();

      await projector.onRiderAssigned(
        evt('RiderAssigned', FULFILLMENT_ID, { riderId: RIDER_ID, assignedAt })
      );

      const ctCall = repo.upsertCustomerTracking.mock.calls[0][0];
      expect(ctCall.set.riderId).toBe(RIDER_ID);
      expect(ctCall.set.deliveryStatus).toBe('ASSIGNED');
      expect(ctCall.timelineEntry.status).toBe('ASSIGNED');
      expect(ctCall.timelineEntry.at).toBe(assignedAt);
    });
  });

  describe('onDeliveryCompleted', () => {
    it('marks the tracking view DELIVERED at the delivery timestamp', async () => {
      const deliveredAt = new Date();
      await projector.onDeliveryCompleted(
        evt('DeliveryCompleted', FULFILLMENT_ID, { riderId: RIDER_ID, deliveredAt })
      );

      const ctCall = repo.upsertCustomerTracking.mock.calls[0][0];
      expect(ctCall.set.currentStatus).toBe('DELIVERED');
      expect(ctCall.set.deliveryStatus).toBe('DELIVERED');
      expect(ctCall.timelineEntry.at).toBe(deliveredAt);
    });
  });

  describe('onFulfillmentCancelled', () => {
    it('marks CANCELLED with cancellation info', async () => {
      await projector.onFulfillmentCancelled(
        evt('FulfillmentCancelled', FULFILLMENT_ID, {
          cancelledBy: 'CUSTOMER',
          reason: 'Changed mind',
          refundHint: { total: TOTAL },
        })
      );

      const ctCall = repo.upsertCustomerTracking.mock.calls[0][0];
      expect(ctCall.set.currentStatus).toBe('CANCELLED');
      expect(ctCall.set.cancellation?.cancelledBy).toBe('CUSTOMER');
      expect(ctCall.set.cancellation?.reason).toBe('Changed mind');
    });
  });

  describe('onDeliveryFailed', () => {
    it('marks FAILED with failureReason', async () => {
      await projector.onDeliveryFailed(
        evt('DeliveryFailed', FULFILLMENT_ID, { riderId: RIDER_ID, failureReason: 'CUSTOMER_UNAVAILABLE' })
      );

      const ctCall = repo.upsertCustomerTracking.mock.calls[0][0];
      expect(ctCall.set.currentStatus).toBe('FAILED');
      expect(ctCall.set.failureReason).toBe('CUSTOMER_UNAVAILABLE');
      expect(ctCall.timelineEntry.note).toBe('CUSTOMER_UNAVAILABLE');
    });
  });

  describe('onRiderReassigned', () => {
    it('updates tracking riderId and records a REASSIGNED timeline entry', async () => {
      const NEW_RIDER = 'rider-2';
      await projector.onRiderReassigned(
        evt('RiderReassigned', FULFILLMENT_ID, {
          previousRiderId: RIDER_ID,
          newRiderId: NEW_RIDER,
          attempt: 2,
        })
      );

      const ctCall = repo.upsertCustomerTracking.mock.calls[0][0];
      expect(ctCall.set.riderId).toBe(NEW_RIDER);
      expect(ctCall.timelineEntry.status).toBe('REASSIGNED');
    });
  });
});

/**
 * Phase 3 / Batch 5: the projector maintains `customer_tracking_views` and nothing else. This pins
 * the subscription set so a rider-queue or admin-dashboard handler cannot be reintroduced silently
 * — `RiderOffered` is absent because it wrote only the retired rider queue and never invalidated
 * the cache.
 */
describe('registerFulfillmentProjector', () => {
  it('subscribes to exactly the ten tracking-relevant events', () => {
    const subscribed: string[] = [];
    const bus: IEventBus = {
      subscribe: (name) => {
        subscribed.push(name);
      },
      publish: jest.fn(),
      publishAll: jest.fn(),
    };

    registerFulfillmentProjector(bus, new FulfillmentProjector(makeRepo()));

    expect(subscribed).toEqual([
      'FulfillmentCreated',
      'PreparationStarted',
      'ReadyForPickup',
      'RiderAssigned',
      'PickupConfirmed',
      'OutForDelivery',
      'DeliveryCompleted',
      'FulfillmentCancelled',
      'DeliveryFailed',
      'RiderReassigned',
    ]);
    expect(subscribed).not.toContain('RiderOffered');
  });
});

describe('GetLiveTracking', () => {
  const { GetLiveTracking } = require('../../../../application/fulfillment/use-cases/GetLiveTracking');

  function makeView(customerId = CUSTOMER_ID): CustomerTrackingView {
    return {
      fulfillmentId: FULFILLMENT_ID,
      orderRequestId: 'or-1',
      customerId,
      restaurantId: RESTAURANT_ID,
      currentStatus: 'PREPARING',
      deliveryStatus: 'UNASSIGNED',
      riderId: null,
      timeline: [],
      deliveryAddress: ADDRESS,
      total: TOTAL,
      cancellation: null,
      failureReason: null,
      updatedAt: new Date(),
    };
  }

  it('allows access when customerId matches', async () => {
    const repo = makeRepo();
    repo.findCustomerTracking.mockResolvedValue(makeView());
    const uc = new GetLiveTracking(repo);
    const result = await uc.execute({ fulfillmentId: FULFILLMENT_ID, customerId: CUSTOMER_ID });
    expect(result.isSuccess).toBe(true);
  });

  it('denies access when customerId does not match', async () => {
    const repo = makeRepo();
    repo.findCustomerTracking.mockResolvedValue(makeView('other-customer'));
    const uc = new GetLiveTracking(repo);
    const result = await uc.execute({ fulfillmentId: FULFILLMENT_ID, customerId: CUSTOMER_ID });
    expect(result.isFailure).toBe(true);
  });

  it('allows access without customerId (admin/rider path)', async () => {
    const repo = makeRepo();
    repo.findCustomerTracking.mockResolvedValue(makeView());
    const uc = new GetLiveTracking(repo);
    const result = await uc.execute({ fulfillmentId: FULFILLMENT_ID });
    expect(result.isSuccess).toBe(true);
  });
});

describe('GetRiderQueue', () => {
  const { GetRiderQueue } = require('../../../../application/fulfillment/use-cases/GetRiderQueue');

  it('returns list of rider queue items', async () => {
    const repo = makeQueryRepo();
    const item: QueryRiderQueueView = {
      riderId: RIDER_ID,
      fulfillmentId: FULFILLMENT_ID,
      assignmentStatus: 'OFFERED',
      attempt: 1,
      expiresAt: new Date(Date.now() + 60000),
      restaurantId: RESTAURANT_ID,
      deliveryAddress: ADDRESS,
      total: TOTAL,
      fulfillmentStatus: 'READY_FOR_PICKUP',
      offeredAt: new Date(),
      updatedAt: new Date(),
    };
    repo.findRiderQueue.mockResolvedValue([item]);
    const uc = new GetRiderQueue(repo);
    const result = await uc.execute({ riderId: RIDER_ID });
    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toHaveLength(1);
    expect(result.getValue()[0].assignmentStatus).toBe('OFFERED');
  });
});

describe('GetAdminDashboard', () => {
  const { GetAdminDashboard } = require('../../../../application/fulfillment/use-cases/GetAdminDashboard');

  it('passes filters to the query repository and returns mapped views', async () => {
    const repo = makeQueryRepo();
    const view: QueryAdminDashboardView = {
      fulfillmentId: FULFILLMENT_ID,
      orderRequestId: 'or-1',
      customerId: CUSTOMER_ID,
      restaurantId: RESTAURANT_ID,
      status: 'FAILED',
      deliveryStatus: 'FAILED',
      riderId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      slaBreached: false,
      exceptionFlag: true,
      cancellation: null,
      failureReason: 'CUSTOMER_UNAVAILABLE',
      total: TOTAL,
    };
    repo.findAdminDashboard.mockResolvedValue([view]);
    const uc = new GetAdminDashboard(repo);
    const result = await uc.execute({ status: 'FAILED', slaBreached: false });
    expect(result.isSuccess).toBe(true);
    expect(result.getValue()[0].exceptionFlag).toBe(true);
    expect(repo.findAdminDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED', slaBreached: false })
    );
  });
});
