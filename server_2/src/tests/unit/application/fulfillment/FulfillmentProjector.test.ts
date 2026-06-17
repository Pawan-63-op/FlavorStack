// Unit tests for FulfillmentProjector (Phase 6).
// All projection writes are mocked via IFulfillmentProjectionRepository.
import { randomUUID } from 'crypto';
import { DomainEvent } from '../../../../domain/shared/DomainEvent';
import { FulfillmentProjector } from '../../../../application/fulfillment/projector/FulfillmentProjector';
import {
  IFulfillmentProjectionRepository,
  CustomerTrackingView,
  RestaurantFulfillmentView,
  RiderQueueView,
} from '../../../../domain/fulfillment/repositories/IFulfillmentProjectionRepository';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeRepo(): jest.Mocked<IFulfillmentProjectionRepository> {
  return {
    upsertCustomerTracking: jest.fn().mockResolvedValue(undefined),
    findCustomerTracking: jest.fn().mockResolvedValue(null),
    upsertRestaurantView: jest.fn().mockResolvedValue(undefined),
    removeRestaurantView: jest.fn().mockResolvedValue(undefined),
    findRestaurantQueue: jest.fn().mockResolvedValue([]),
    upsertRiderQueueItem: jest.fn().mockResolvedValue(undefined),
    removeRiderQueueItem: jest.fn().mockResolvedValue(undefined),
    removeAllRiderQueueItemsForFulfillment: jest.fn().mockResolvedValue(undefined),
    findRiderQueue: jest.fn().mockResolvedValue([]),
    upsertAdminView: jest.fn().mockResolvedValue(undefined),
    patchAdminView: jest.fn().mockResolvedValue(undefined),
    findAdminDashboard: jest.fn().mockResolvedValue([]),
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

// ── tests ─────────────────────────────────────────────────────────────────────

describe('FulfillmentProjector', () => {
  let repo: jest.Mocked<IFulfillmentProjectionRepository>;
  let projector: FulfillmentProjector;

  beforeEach(() => {
    repo = makeRepo();
    projector = new FulfillmentProjector(repo);
  });

  // ── FulfillmentCreated ───────────────────────────────────────────────────
  describe('onFulfillmentCreated', () => {
    it('seeds CustomerTrackingView, RestaurantFulfillmentView, and AdminDashboardView', async () => {
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

      expect(repo.upsertRestaurantView).toHaveBeenCalledTimes(1);
      const rvArgs = repo.upsertRestaurantView.mock.calls[0][0];
      expect(rvArgs.restaurantId).toBe(RESTAURANT_ID);
      expect(rvArgs.status).toBe('CREATED');
      expect(rvArgs.lines).toHaveLength(1);

      expect(repo.upsertAdminView).toHaveBeenCalledTimes(1);
      const avArgs = repo.upsertAdminView.mock.calls[0][0];
      expect(avArgs.status).toBe('CREATED');
      expect(avArgs.slaBreached).toBe(false);
    });
  });

  // ── PreparationStarted ───────────────────────────────────────────────────
  describe('onPreparationStarted', () => {
    it('updates CustomerTracking and patches AdminView status to PREPARING', async () => {
      const existingRow: RestaurantFulfillmentView = {
        fulfillmentId: FULFILLMENT_ID,
        restaurantId: RESTAURANT_ID,
        customerId: CUSTOMER_ID,
        orderRequestId: 'or-1',
        status: 'CREATED',
        prepEstimateMinutes: null,
        lines: [],
        total: TOTAL,
        createdAt: new Date(),
        readyAt: null,
        updatedAt: new Date(),
      };
      repo.findRestaurantQueue.mockResolvedValue([existingRow]);

      await projector.onPreparationStarted(
        evt('PreparationStarted', FULFILLMENT_ID, { restaurantId: RESTAURANT_ID, prepEstimateMinutes: 15 })
      );

      expect(repo.upsertCustomerTracking).toHaveBeenCalledTimes(1);
      expect(repo.upsertCustomerTracking.mock.calls[0][0].set.currentStatus).toBe('PREPARING');

      expect(repo.upsertRestaurantView).toHaveBeenCalledTimes(1);
      expect(repo.upsertRestaurantView.mock.calls[0][0].prepEstimateMinutes).toBe(15);
      expect(repo.upsertRestaurantView.mock.calls[0][0].status).toBe('PREPARING');

      expect(repo.patchAdminView).toHaveBeenCalledWith(FULFILLMENT_ID, expect.objectContaining({ status: 'PREPARING' }));
    });
  });

  // ── ReadyForPickup ──────────────────────────────────────────────────────
  describe('onReadyForPickup', () => {
    it('updates CustomerTracking, RestaurantView readyAt, and AdminView', async () => {
      const existingRow: RestaurantFulfillmentView = {
        fulfillmentId: FULFILLMENT_ID,
        restaurantId: RESTAURANT_ID,
        customerId: CUSTOMER_ID,
        orderRequestId: 'or-1',
        status: 'PREPARING',
        prepEstimateMinutes: null,
        lines: [],
        total: TOTAL,
        createdAt: new Date(),
        readyAt: null,
        updatedAt: new Date(),
      };
      repo.findRestaurantQueue.mockResolvedValue([existingRow]);
      const readyAt = new Date();

      await projector.onReadyForPickup(
        evt('ReadyForPickup', FULFILLMENT_ID, { restaurantId: RESTAURANT_ID, readyAt })
      );

      expect(repo.upsertCustomerTracking.mock.calls[0][0].set.currentStatus).toBe('READY_FOR_PICKUP');
      expect(repo.upsertRestaurantView.mock.calls[0][0].readyAt).toBe(readyAt);
      expect(repo.patchAdminView).toHaveBeenCalledWith(FULFILLMENT_ID, expect.objectContaining({ status: 'READY_FOR_PICKUP' }));
    });
  });

  // ── RiderOffered ────────────────────────────────────────────────────────
  describe('onRiderOffered', () => {
    it('adds rider queue item when tracking view exists', async () => {
      const trackingView: CustomerTrackingView = {
        fulfillmentId: FULFILLMENT_ID,
        orderRequestId: 'or-1',
        customerId: CUSTOMER_ID,
        restaurantId: RESTAURANT_ID,
        currentStatus: 'READY_FOR_PICKUP',
        deliveryStatus: 'UNASSIGNED',
        riderId: null,
        timeline: [],
        deliveryAddress: ADDRESS,
        total: TOTAL,
        cancellation: null,
        failureReason: null,
        updatedAt: new Date(),
      };
      repo.findCustomerTracking.mockResolvedValue(trackingView);

      const expiresAt = new Date(Date.now() + 60000);
      await projector.onRiderOffered(
        evt('RiderOffered', FULFILLMENT_ID, { riderId: RIDER_ID, attempt: 1, expiresAt })
      );

      expect(repo.upsertRiderQueueItem).toHaveBeenCalledTimes(1);
      const item = repo.upsertRiderQueueItem.mock.calls[0][0];
      expect(item.riderId).toBe(RIDER_ID);
      expect(item.assignmentStatus).toBe('OFFERED');
      expect(item.attempt).toBe(1);
    });

    it('is a no-op when tracking view does not exist', async () => {
      repo.findCustomerTracking.mockResolvedValue(null);
      await projector.onRiderOffered(
        evt('RiderOffered', FULFILLMENT_ID, { riderId: RIDER_ID, attempt: 1, expiresAt: new Date() })
      );
      expect(repo.upsertRiderQueueItem).not.toHaveBeenCalled();
    });
  });

  // ── RiderAssigned ───────────────────────────────────────────────────────
  describe('onRiderAssigned', () => {
    it('updates CustomerTracking rider, moves queue item to ACCEPTED, and patches AdminView', async () => {
      const existingQueueItem: RiderQueueView = {
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
      repo.findRiderQueue.mockResolvedValue([existingQueueItem]);

      await projector.onRiderAssigned(
        evt('RiderAssigned', FULFILLMENT_ID, { riderId: RIDER_ID, assignedAt: new Date() })
      );

      expect(repo.upsertCustomerTracking.mock.calls[0][0].set.riderId).toBe(RIDER_ID);
      expect(repo.upsertRiderQueueItem.mock.calls[0][0].assignmentStatus).toBe('ACCEPTED');
      expect(repo.patchAdminView).toHaveBeenCalledWith(
        FULFILLMENT_ID,
        expect.objectContaining({ riderId: RIDER_ID, deliveryStatus: 'ASSIGNED' })
      );
    });
  });

  // ── RiderAssignmentExpired ──────────────────────────────────────────────
  describe('onRiderAssignmentExpired', () => {
    it('removes the rider queue item', async () => {
      await projector.onRiderAssignmentExpired(
        evt('RiderAssignmentExpired', FULFILLMENT_ID, { riderId: RIDER_ID, attempt: 1 })
      );
      expect(repo.removeRiderQueueItem).toHaveBeenCalledWith(RIDER_ID, FULFILLMENT_ID);
    });
  });

  // ── DeliveryCompleted ───────────────────────────────────────────────────
  describe('onDeliveryCompleted', () => {
    it('marks DELIVERED, removes restaurant view, removes all rider queue items', async () => {
      const deliveredAt = new Date();
      await projector.onDeliveryCompleted(
        evt('DeliveryCompleted', FULFILLMENT_ID, { riderId: RIDER_ID, deliveredAt })
      );

      expect(repo.upsertCustomerTracking.mock.calls[0][0].set.currentStatus).toBe('DELIVERED');
      expect(repo.removeRestaurantView).toHaveBeenCalledWith(FULFILLMENT_ID);
      expect(repo.removeAllRiderQueueItemsForFulfillment).toHaveBeenCalledWith(FULFILLMENT_ID);
      expect(repo.patchAdminView).toHaveBeenCalledWith(
        FULFILLMENT_ID,
        expect.objectContaining({ status: 'DELIVERED' })
      );
    });
  });

  // ── FulfillmentCancelled ────────────────────────────────────────────────
  describe('onFulfillmentCancelled', () => {
    it('marks CANCELLED with cancellation info and flags exceptionFlag in admin view', async () => {
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
      expect(repo.removeRestaurantView).toHaveBeenCalledWith(FULFILLMENT_ID);
      expect(repo.removeAllRiderQueueItemsForFulfillment).toHaveBeenCalledWith(FULFILLMENT_ID);
      expect(repo.patchAdminView).toHaveBeenCalledWith(
        FULFILLMENT_ID,
        expect.objectContaining({ status: 'CANCELLED', exceptionFlag: true })
      );
    });
  });

  // ── DeliveryFailed ──────────────────────────────────────────────────────
  describe('onDeliveryFailed', () => {
    it('marks FAILED with failureReason and sets exceptionFlag', async () => {
      await projector.onDeliveryFailed(
        evt('DeliveryFailed', FULFILLMENT_ID, { riderId: RIDER_ID, failureReason: 'CUSTOMER_UNAVAILABLE' })
      );

      const ctCall = repo.upsertCustomerTracking.mock.calls[0][0];
      expect(ctCall.set.currentStatus).toBe('FAILED');
      expect(ctCall.set.failureReason).toBe('CUSTOMER_UNAVAILABLE');
      expect(repo.patchAdminView).toHaveBeenCalledWith(
        FULFILLMENT_ID,
        expect.objectContaining({ status: 'FAILED', exceptionFlag: true, failureReason: 'CUSTOMER_UNAVAILABLE' })
      );
    });
  });

  // ── RiderReassigned ─────────────────────────────────────────────────────
  describe('onRiderReassigned', () => {
    it('updates tracking riderId and removes old rider queue item', async () => {
      const NEW_RIDER = 'rider-2';
      await projector.onRiderReassigned(
        evt('RiderReassigned', FULFILLMENT_ID, {
          previousRiderId: RIDER_ID,
          newRiderId: NEW_RIDER,
          attempt: 2,
        })
      );

      expect(repo.upsertCustomerTracking.mock.calls[0][0].set.riderId).toBe(NEW_RIDER);
      expect(repo.removeRiderQueueItem).toHaveBeenCalledWith(RIDER_ID, FULFILLMENT_ID);
      expect(repo.patchAdminView).toHaveBeenCalledWith(
        FULFILLMENT_ID,
        expect.objectContaining({ riderId: NEW_RIDER })
      );
    });
  });
});

// ── GetFulfillment use case ──────────────────────────────────────────────────
describe('GetFulfillment', () => {
  const { GetFulfillment } = require('../../../../application/fulfillment/use-cases/GetFulfillment');

  it('returns TrackingResponse when view exists', async () => {
    const repo = makeRepo();
    const view: CustomerTrackingView = {
      fulfillmentId: FULFILLMENT_ID,
      orderRequestId: 'or-1',
      customerId: CUSTOMER_ID,
      restaurantId: RESTAURANT_ID,
      currentStatus: 'CREATED',
      deliveryStatus: 'UNASSIGNED',
      riderId: null,
      timeline: [{ eventId: 'e1', status: 'CREATED', at: new Date() }],
      deliveryAddress: ADDRESS,
      total: TOTAL,
      cancellation: null,
      failureReason: null,
      updatedAt: new Date(),
    };
    repo.findCustomerTracking.mockResolvedValue(view);

    const uc = new GetFulfillment(repo);
    const result = await uc.execute({ fulfillmentId: FULFILLMENT_ID });
    expect(result.isSuccess).toBe(true);
    expect(result.getValue().currentStatus).toBe('CREATED');
    expect(result.getValue().timeline).toHaveLength(1);
  });

  it('returns NotFoundError when view does not exist', async () => {
    const repo = makeRepo();
    repo.findCustomerTracking.mockResolvedValue(null);
    const uc = new GetFulfillment(repo);
    const result = await uc.execute({ fulfillmentId: 'nonexistent' });
    expect(result.isFailure).toBe(true);
  });
});

// ── GetLiveTracking use case ─────────────────────────────────────────────────
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

// ── GetRiderQueue use case ───────────────────────────────────────────────────
describe('GetRiderQueue', () => {
  const { GetRiderQueue } = require('../../../../application/fulfillment/use-cases/GetRiderQueue');

  it('returns list of rider queue items', async () => {
    const repo = makeRepo();
    const item: RiderQueueView = {
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

// ── GetAdminDashboard use case ───────────────────────────────────────────────
describe('GetAdminDashboard', () => {
  const { GetAdminDashboard } = require('../../../../application/fulfillment/use-cases/GetAdminDashboard');

  it('passes filters to the projection repository and returns mapped views', async () => {
    const repo = makeRepo();
    repo.findAdminDashboard.mockResolvedValue([
      {
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
      },
    ]);
    const uc = new GetAdminDashboard(repo);
    const result = await uc.execute({ status: 'FAILED', slaBreached: false });
    expect(result.isSuccess).toBe(true);
    expect(result.getValue()[0].exceptionFlag).toBe(true);
    expect(repo.findAdminDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED', slaBreached: false })
    );
  });
});
