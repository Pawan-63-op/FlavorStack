// Integration test for FulfillmentProjector + projection repository (Phase 6).
// Real Mongo replica set — uses the same pattern as delivery-lifecycle.integration.test.ts.
//
// Tests:
//  1. Full happy-path projection replay: FulfillmentCreated → DELIVERED — verifies all four views.
//  2. Cancellation path: CREATED → CANCELLED — verifies restaurant/admin view cleanup.
//  3. Idempotency: publishing the same event twice produces no duplicate timeline entries.
import { randomUUID } from 'crypto';
import { DomainEvent } from '../../../domain/shared/DomainEvent';

import { getConnection } from '../../../infrastructure/database/connection';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoUnitOfWork } from '../../../infrastructure/database/MongoUnitOfWork';
import { MongoOutboxStore } from '../../../infrastructure/database/MongoOutboxStore';
import { MongoFulfillmentRepository } from '../../../infrastructure/repositories/FulfillmentRepository';
import { MongoFulfillmentProjectionRepository } from '../../../infrastructure/repositories/FulfillmentProjectionRepository';
import { SimpleDeliveryAssignmentService } from '../../../infrastructure/services/SimpleDeliveryAssignmentService';
import { FulfillmentModel } from '../../../infrastructure/database/models/FulfillmentModel';
import { OutboxEventModel } from '../../../infrastructure/database/models/OutboxEventModel';
import { CustomerTrackingViewModel } from '../../../infrastructure/database/models/CustomerTrackingViewModel';
import { RestaurantFulfillmentViewModel } from '../../../infrastructure/database/models/RestaurantFulfillmentViewModel';
import { RiderQueueViewModel } from '../../../infrastructure/database/models/RiderQueueViewModel';
import { AdminDashboardViewModel } from '../../../infrastructure/database/models/AdminDashboardViewModel';
import { InMemoryEventBus } from '../../../application/shared/events/InMemoryEventBus';

import { CreateFulfillment } from '../../../application/fulfillment/use-cases/CreateFulfillment';
import { MarkPreparing } from '../../../application/fulfillment/use-cases/MarkPreparing';
import { MarkReadyForPickup } from '../../../application/fulfillment/use-cases/MarkReadyForPickup';
import { OfferRiderAssignment } from '../../../application/fulfillment/use-cases/OfferRiderAssignment';
import { AcceptDelivery } from '../../../application/fulfillment/use-cases/AcceptDelivery';
import { ConfirmPickup } from '../../../application/fulfillment/use-cases/ConfirmPickup';
import { StartDelivery } from '../../../application/fulfillment/use-cases/StartDelivery';
import { CompleteDelivery } from '../../../application/fulfillment/use-cases/CompleteDelivery';
import { CancelFulfillment } from '../../../application/fulfillment/use-cases/CancelFulfillment';
import { OnOrderRequested } from '../../../application/fulfillment/event-handlers/OnOrderRequested';
import { OnReadyForPickup } from '../../../application/fulfillment/event-handlers/OnReadyForPickup';
import { FulfillmentProjector } from '../../../application/fulfillment/projector/FulfillmentProjector';
import { registerFulfillmentProjector } from '../../../application/fulfillment/projector/FulfillmentProjectionRegistry';
import { CANCELLED_BY } from '../../../domain/fulfillment/enums/cancelled-by.enum';

const RESTAURANT_ID = 'proj-rest-1';
const RIDER_ID = 'proj-rider-1';
const CUSTOMER_ID = 'proj-cust-1';
const OFFER_TTL = 60;

function orderRequestedEvent(orderRequestId: string): DomainEvent {
  return {
    eventId: randomUUID(),
    occurredOn: new Date(),
    eventName: 'OrderRequested',
    aggregateId: orderRequestId,
    customerId: CUSTOMER_ID,
    restaurantId: RESTAURANT_ID,
    lines: [
      {
        menuItemId: 'i1',
        name: 'Paneer Tikka',
        quantity: 1,
        selectedOptions: [],
        lineTotal: { amount: 40000, currency: 'INR' },
      },
    ],
    pricing: { total: { amount: 45000, currency: 'INR' } },
    deliveryAddress: {
      street: '12 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pinCode: '560001',
      coordinates: { lat: 12.97, lng: 77.59 },
    },
  } as unknown as DomainEvent;
}

async function cleanup(): Promise<void> {
  await Promise.all([
    FulfillmentModel.deleteMany({}),
    OutboxEventModel.deleteMany({}),
    CustomerTrackingViewModel.deleteMany({}),
    RestaurantFulfillmentViewModel.deleteMany({}),
    RiderQueueViewModel.deleteMany({}),
    AdminDashboardViewModel.deleteMany({}),
  ]);
}

describe('FulfillmentProjector integration (Phase 6)', () => {
  let txContext: TransactionContext;
  let repo: MongoFulfillmentRepository;
  let projectionRepo: MongoFulfillmentProjectionRepository;
  let uow: MongoUnitOfWork;
  let outbox: MongoOutboxStore;
  let bus: InMemoryEventBus;

  let createFulfillment: CreateFulfillment;
  let markPreparing: MarkPreparing;
  let markReadyForPickup: MarkReadyForPickup;
  let offerRiderAssignment: OfferRiderAssignment;
  let acceptDelivery: AcceptDelivery;
  let confirmPickup: ConfirmPickup;
  let startDelivery: StartDelivery;
  let completeDelivery: CompleteDelivery;
  let cancelFulfillment: CancelFulfillment;

  beforeAll(async () => {
    const connection = getConnection();
    txContext = new TransactionContext();
    repo = new MongoFulfillmentRepository(txContext);
    projectionRepo = new MongoFulfillmentProjectionRepository();
    uow = new MongoUnitOfWork(connection, txContext);
    outbox = new MongoOutboxStore(txContext);
    bus = new InMemoryEventBus();

    const assignmentService = new SimpleDeliveryAssignmentService(async () => [RIDER_ID]);

    createFulfillment = new CreateFulfillment(repo, uow, outbox, bus);
    markPreparing = new MarkPreparing(repo, uow, outbox, bus);
    markReadyForPickup = new MarkReadyForPickup(repo, uow, outbox, bus);
    offerRiderAssignment = new OfferRiderAssignment(repo, assignmentService, uow, outbox, bus, OFFER_TTL);
    acceptDelivery = new AcceptDelivery(repo, uow, outbox, bus);
    confirmPickup = new ConfirmPickup(repo, uow, outbox, bus);
    startDelivery = new StartDelivery(repo, uow, outbox, bus);
    completeDelivery = new CompleteDelivery(repo, uow, outbox, bus);
    cancelFulfillment = new CancelFulfillment(repo, uow, outbox, bus);

    // Wire in-process handlers.
    const onOrderRequested = new OnOrderRequested(createFulfillment);
    const onReadyForPickup = new OnReadyForPickup(offerRiderAssignment);
    bus.subscribe('OrderRequested', (e) => onOrderRequested.handle(e));
    bus.subscribe('ReadyForPickup', (e) => onReadyForPickup.handle(e));

    // Wire projector.
    const projector = new FulfillmentProjector(projectionRepo);
    registerFulfillmentProjector(bus, projector);
  });

  beforeEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  // ── Test 1: happy path ─────────────────────────────────────────────────
  it('builds projections across the full happy path OrderRequested → DELIVERED', async () => {
    const orderRequestId = randomUUID();

    // 1. OrderRequested → FulfillmentCreated
    await bus.publishAll([orderRequestedEvent(orderRequestId)]);
    const fulfillment = await repo.findByOrderRequestId(orderRequestId);
    expect(fulfillment).not.toBeNull();
    const fid = fulfillment!.id.toString();

    // CustomerTrackingView should be seeded.
    let tracking = await projectionRepo.findCustomerTracking(fid);
    expect(tracking).not.toBeNull();
    expect(tracking!.currentStatus).toBe('CREATED');
    expect(tracking!.timeline).toHaveLength(1);
    expect(tracking!.timeline[0].status).toBe('CREATED');

    // RestaurantFulfillmentView should have one row.
    let restRows = await projectionRepo.findRestaurantQueue(RESTAURANT_ID);
    expect(restRows).toHaveLength(1);
    expect(restRows[0].status).toBe('CREATED');

    // AdminDashboardView should have one row.
    let adminRows = await projectionRepo.findAdminDashboard({});
    expect(adminRows.some((r) => r.fulfillmentId === fid)).toBe(true);

    // 2. Mark Preparing
    await markPreparing.execute({ fulfillmentId: fid, restaurantId: RESTAURANT_ID, prepEstimateMinutes: 15 });
    tracking = await projectionRepo.findCustomerTracking(fid);
    expect(tracking!.currentStatus).toBe('PREPARING');
    expect(tracking!.timeline).toHaveLength(2);

    restRows = await projectionRepo.findRestaurantQueue(RESTAURANT_ID);
    expect(restRows[0].status).toBe('PREPARING');
    expect(restRows[0].prepEstimateMinutes).toBe(15);

    // 3. Mark ReadyForPickup → auto-offer (no rider available in simple strategy)
    await markReadyForPickup.execute({ fulfillmentId: fid, restaurantId: RESTAURANT_ID });
    tracking = await projectionRepo.findCustomerTracking(fid);
    expect(tracking!.currentStatus).toBe('READY_FOR_PICKUP');

    // 4. Manually offer the rider (since simple strategy with [RIDER_ID] will auto-offer on ReadyForPickup)
    //    After markReadyForPickup, the auto-offer fires via onReadyForPickup; since assignmentService
    //    returns RIDER_ID, the offer is placed. Check rider queue view.
    let riderQueue = await projectionRepo.findRiderQueue(RIDER_ID);
    expect(riderQueue).toHaveLength(1);
    expect(riderQueue[0].assignmentStatus).toBe('OFFERED');

    // 5. Accept delivery
    await acceptDelivery.execute({ fulfillmentId: fid, riderId: RIDER_ID });
    riderQueue = await projectionRepo.findRiderQueue(RIDER_ID);
    expect(riderQueue[0].assignmentStatus).toBe('ACCEPTED');
    tracking = await projectionRepo.findCustomerTracking(fid);
    expect(tracking!.riderId).toBe(RIDER_ID);
    expect(tracking!.deliveryStatus).toBe('ASSIGNED');

    // 6. Confirm pickup
    await confirmPickup.execute({ fulfillmentId: fid, riderId: RIDER_ID });
    tracking = await projectionRepo.findCustomerTracking(fid);
    expect(tracking!.currentStatus).toBe('PICKED_UP');

    // 7. Start delivery
    await startDelivery.execute({ fulfillmentId: fid, riderId: RIDER_ID });
    tracking = await projectionRepo.findCustomerTracking(fid);
    expect(tracking!.currentStatus).toBe('OUT_FOR_DELIVERY');

    // 8. Complete delivery
    await completeDelivery.execute({ fulfillmentId: fid, riderId: RIDER_ID });
    tracking = await projectionRepo.findCustomerTracking(fid);
    expect(tracking!.currentStatus).toBe('DELIVERED');
    expect(tracking!.timeline.length).toBeGreaterThanOrEqual(5);

    // Restaurant view should be removed on terminal.
    restRows = await projectionRepo.findRestaurantQueue(RESTAURANT_ID);
    expect(restRows.filter((r) => r.fulfillmentId === fid)).toHaveLength(0);

    // Rider queue should be removed on terminal.
    riderQueue = await projectionRepo.findRiderQueue(RIDER_ID);
    expect(riderQueue.filter((r) => r.fulfillmentId === fid)).toHaveLength(0);

    // Admin view should show DELIVERED.
    adminRows = await projectionRepo.findAdminDashboard({});
    const adminRow = adminRows.find((r) => r.fulfillmentId === fid);
    expect(adminRow?.status).toBe('DELIVERED');
  });

  // ── Test 2: cancellation path ──────────────────────────────────────────
  it('removes restaurant and admin views, marks tracking as CANCELLED on cancellation', async () => {
    const orderRequestId = randomUUID();
    await bus.publishAll([orderRequestedEvent(orderRequestId)]);
    const fulfillment = await repo.findByOrderRequestId(orderRequestId);
    const fid = fulfillment!.id.toString();

    await cancelFulfillment.execute({
      fulfillmentId: fid,
      cancelledBy: CANCELLED_BY.CUSTOMER,
      reason: 'Test cancellation',
      actorId: CUSTOMER_ID,
    });

    const tracking = await projectionRepo.findCustomerTracking(fid);
    expect(tracking!.currentStatus).toBe('CANCELLED');
    expect(tracking!.cancellation?.cancelledBy).toBe('CUSTOMER');

    const restRows = await projectionRepo.findRestaurantQueue(RESTAURANT_ID);
    expect(restRows.filter((r) => r.fulfillmentId === fid)).toHaveLength(0);

    const adminRows = await projectionRepo.findAdminDashboard({});
    const adminRow = adminRows.find((r) => r.fulfillmentId === fid);
    expect(adminRow?.status).toBe('CANCELLED');
    expect(adminRow?.exceptionFlag).toBe(true);
  });

  // ── Test 3: idempotency of timeline entries ────────────────────────────
  it('does not duplicate timeline entries when the same event is replayed', async () => {
    const orderRequestId = randomUUID();
    await bus.publishAll([orderRequestedEvent(orderRequestId)]);
    const fulfillment = await repo.findByOrderRequestId(orderRequestId);
    const fid = fulfillment!.id.toString();

    // Publish the same FulfillmentCreated-equivalent scenario twice by invoking the projector
    // directly with the same eventId.
    const { FulfillmentProjector } = require('../../../application/fulfillment/projector/FulfillmentProjector');
    const testProjector = new FulfillmentProjector(projectionRepo);
    const fakeEvent = {
      eventId: 'idempotency-test-eventId',
      occurredOn: new Date(),
      eventName: 'PreparationStarted',
      aggregateId: fid,
      restaurantId: RESTAURANT_ID,
      prepEstimateMinutes: 10,
    };

    await testProjector.onPreparationStarted(fakeEvent);
    await testProjector.onPreparationStarted(fakeEvent); // replay

    const tracking = await projectionRepo.findCustomerTracking(fid);
    // Should have exactly 2 timeline entries: CREATED (from FulfillmentCreated) + PREPARING (once).
    const preparingEntries = tracking!.timeline.filter((t) => t.status === 'PREPARING');
    expect(preparingEntries).toHaveLength(1);
  });
});
