import { randomUUID } from 'crypto';
import { DomainEvent } from '../../../domain/shared/DomainEvent';

import { getConnection } from '../../../infrastructure/database/connection';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoUnitOfWork } from '../../../infrastructure/database/MongoUnitOfWork';
import { MongoFulfillmentRepository } from '../../../infrastructure/repositories/FulfillmentRepository';
import { MongoCustomerTrackingRepository } from '../../../infrastructure/repositories/CustomerTrackingRepository';
import { SimpleDeliveryAssignmentService } from '../../../infrastructure/services/SimpleDeliveryAssignmentService';
import { FulfillmentModel } from '../../../infrastructure/database/models/FulfillmentModel';
import { OutboxEventModel } from '../../../infrastructure/database/models/OutboxEventModel';
import { CustomerTrackingViewModel } from '../../../infrastructure/database/models/CustomerTrackingViewModel';
import { InMemoryEventBus } from '../../../application/shared/events/InMemoryEventBus';

import { CreateFulfillment } from '../../../application/fulfillment/use-cases/CreateFulfillment';
import { MarkPreparing } from '../../../application/fulfillment/use-cases/MarkPreparing';
import { MarkReadyForPickup } from '../../../application/fulfillment/use-cases/MarkReadyForPickup';
import { makeStubRestaurantDirectory } from '../../mocks/fulfillment.mocks';
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
const OWNER_ID = 'owner-1';
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
  ]);
}

/**
 * Phase 3 / Batch 5: the projector maintains `customer_tracking_views` and nothing else, so these
 * assertions are tracking-only. The rider queue and admin dashboard now read the `fulfillments`
 * aggregate — covered by `rider-reads` / `admin-dashboard` integration suites.
 */
describe('FulfillmentProjector integration (Phase 6)', () => {
  let txContext: TransactionContext;
  let repo: MongoFulfillmentRepository;
  let trackingRepo: MongoCustomerTrackingRepository;
  let uow: MongoUnitOfWork;
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
    trackingRepo = new MongoCustomerTrackingRepository();
    uow = new MongoUnitOfWork(connection, txContext);
    bus = new InMemoryEventBus();

    const assignmentService = new SimpleDeliveryAssignmentService(async () => [RIDER_ID]);

    createFulfillment = new CreateFulfillment(repo, uow, bus);
    const restaurantDirectory = makeStubRestaurantDirectory(RESTAURANT_ID, OWNER_ID);
    markPreparing = new MarkPreparing(repo, restaurantDirectory, uow, bus);
    markReadyForPickup = new MarkReadyForPickup(repo, restaurantDirectory, uow, bus);
    offerRiderAssignment = new OfferRiderAssignment(repo, assignmentService, uow, bus, OFFER_TTL);
    acceptDelivery = new AcceptDelivery(repo, uow, bus);
    confirmPickup = new ConfirmPickup(repo, uow, bus);
    startDelivery = new StartDelivery(repo, uow, bus);
    completeDelivery = new CompleteDelivery(repo, uow, bus);
    cancelFulfillment = new CancelFulfillment(repo, uow, bus);

    const onOrderRequested = new OnOrderRequested(createFulfillment);
    const onReadyForPickup = new OnReadyForPickup(offerRiderAssignment);
    bus.subscribe('OrderRequested', (e) => onOrderRequested.handle(e));
    bus.subscribe('ReadyForPickup', (e) => onReadyForPickup.handle(e));

    const projector = new FulfillmentProjector(trackingRepo);
    registerFulfillmentProjector(bus, projector);
  });

  beforeEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  it('builds projections across the full happy path OrderRequested → DELIVERED', async () => {
    const orderRequestId = randomUUID();

    await bus.publishAll([orderRequestedEvent(orderRequestId)]);
    const fulfillment = await repo.findByOrderRequestId(orderRequestId);
    expect(fulfillment).not.toBeNull();
    const fid = fulfillment!.id.toString();

    let tracking = await trackingRepo.findCustomerTracking(fid);
    expect(tracking).not.toBeNull();
    expect(tracking!.currentStatus).toBe('CREATED');
    expect(tracking!.timeline).toHaveLength(1);
    expect(tracking!.timeline[0].status).toBe('CREATED');

    await markPreparing.execute({ fulfillmentId: fid, actorUserId: OWNER_ID, prepEstimateMinutes: 15 });
    tracking = await trackingRepo.findCustomerTracking(fid);
    expect(tracking!.currentStatus).toBe('PREPARING');
    expect(tracking!.timeline).toHaveLength(2);

    // prepEstimateMinutes lives on the aggregate now that restaurant_fulfillment_views is gone.
    const preparing = await repo.findById(fid);
    expect(preparing!.prepEstimateMinutes).toBe(15);

    await markReadyForPickup.execute({ fulfillmentId: fid, actorUserId: OWNER_ID });
    tracking = await trackingRepo.findCustomerTracking(fid);
    expect(tracking!.currentStatus).toBe('READY_FOR_PICKUP');

    await acceptDelivery.execute({ fulfillmentId: fid, riderId: RIDER_ID });
    tracking = await trackingRepo.findCustomerTracking(fid);
    expect(tracking!.riderId).toBe(RIDER_ID);
    expect(tracking!.deliveryStatus).toBe('ASSIGNED');

    await confirmPickup.execute({ fulfillmentId: fid, riderId: RIDER_ID });
    tracking = await trackingRepo.findCustomerTracking(fid);
    expect(tracking!.currentStatus).toBe('PICKED_UP');

    await startDelivery.execute({ fulfillmentId: fid, riderId: RIDER_ID });
    tracking = await trackingRepo.findCustomerTracking(fid);
    expect(tracking!.currentStatus).toBe('OUT_FOR_DELIVERY');

    await completeDelivery.execute({ fulfillmentId: fid, riderId: RIDER_ID });
    tracking = await trackingRepo.findCustomerTracking(fid);
    expect(tracking!.currentStatus).toBe('DELIVERED');
    expect(tracking!.timeline.length).toBeGreaterThanOrEqual(5);
    expect(tracking!.timeline.map((t) => t.status)).toEqual([
      'CREATED',
      'PREPARING',
      'READY_FOR_PICKUP',
      'ASSIGNED',
      'PICKED_UP',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
    ]);
  });

  it('marks tracking as CANCELLED on cancellation', async () => {
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

    const tracking = await trackingRepo.findCustomerTracking(fid);
    expect(tracking!.currentStatus).toBe('CANCELLED');
    expect(tracking!.cancellation?.cancelledBy).toBe('CUSTOMER');
    expect(tracking!.cancellation?.reason).toBe('Test cancellation');
    expect(tracking!.timeline.map((t) => t.status)).toContain('CANCELLED');
  });

  it('does not duplicate timeline entries when the same event is replayed', async () => {
    const orderRequestId = randomUUID();
    await bus.publishAll([orderRequestedEvent(orderRequestId)]);
    const fulfillment = await repo.findByOrderRequestId(orderRequestId);
    const fid = fulfillment!.id.toString();

    const { FulfillmentProjector } = require('../../../application/fulfillment/projector/FulfillmentProjector');
    const testProjector = new FulfillmentProjector(trackingRepo);
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

    const tracking = await trackingRepo.findCustomerTracking(fid);
    const preparingEntries = tracking!.timeline.filter((t) => t.status === 'PREPARING');
    expect(preparingEntries).toHaveLength(1);
  });
});
