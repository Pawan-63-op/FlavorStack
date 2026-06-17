// Integration (real Mongo replica set + in-process bus) for Phase 5B failure & reassignment:
//   • Reassignment: an ACCEPTED rider is dropped and the delivery handed to a new rider — the prior
//     attempt is preserved as REASSIGNED in history, the new rider is ACCEPTED (attempt 2), and a
//     single RiderReassigned lands in the outbox.
//   • Failure: a PICKED_UP delivery fails — terminal FAILED, failureReason persisted, one DeliveryFailed.
import { randomUUID } from 'crypto';
import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { Fulfillment } from '../../../domain/fulfillment/entities/Fulfillment';
import { FULFILLMENT_STATUS } from '../../../domain/fulfillment/enums/fulfillment-status.enum';
import { DELIVERY_STATUS } from '../../../domain/fulfillment/enums/delivery-status.enum';
import { RIDER_ASSIGNMENT_STATUS } from '../../../domain/fulfillment/enums/rider-assignment-status.enum';
import { FAILURE_REASON } from '../../../domain/fulfillment/enums/failure-reason.enum';

import { getConnection } from '../../../infrastructure/database/connection';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoUnitOfWork } from '../../../infrastructure/database/MongoUnitOfWork';
import { MongoOutboxStore } from '../../../infrastructure/database/MongoOutboxStore';
import { MongoFulfillmentRepository } from '../../../infrastructure/repositories/FulfillmentRepository';
import { SimpleDeliveryAssignmentService } from '../../../infrastructure/services/SimpleDeliveryAssignmentService';
import { FulfillmentModel } from '../../../infrastructure/database/models/FulfillmentModel';
import { OutboxEventModel } from '../../../infrastructure/database/models/OutboxEventModel';
import { InMemoryEventBus } from '../../../application/shared/events/InMemoryEventBus';

import { CreateFulfillment } from '../../../application/fulfillment/use-cases/CreateFulfillment';
import { MarkPreparing } from '../../../application/fulfillment/use-cases/MarkPreparing';
import { MarkReadyForPickup } from '../../../application/fulfillment/use-cases/MarkReadyForPickup';
import { OfferRiderAssignment } from '../../../application/fulfillment/use-cases/OfferRiderAssignment';
import { AssignRider } from '../../../application/fulfillment/use-cases/AssignRider';
import { AcceptDelivery } from '../../../application/fulfillment/use-cases/AcceptDelivery';
import { ConfirmPickup } from '../../../application/fulfillment/use-cases/ConfirmPickup';
import { ReassignRider } from '../../../application/fulfillment/use-cases/ReassignRider';
import { FailDelivery } from '../../../application/fulfillment/use-cases/FailDelivery';
import { OnOrderRequested } from '../../../application/fulfillment/event-handlers/OnOrderRequested';

const CUSTOMER_ID = 'cust-1';
const RESTAURANT_ID = 'rest-1';
const RIDER_1 = 'rider-1';
const RIDER_2 = 'rider-2';

function orderRequestedEvent(orderRequestId: string): DomainEvent {
  return {
    eventId: randomUUID(),
    occurredOn: new Date(),
    eventName: 'OrderRequested',
    aggregateId: orderRequestId,
    customerId: CUSTOMER_ID,
    restaurantId: RESTAURANT_ID,
    lines: [
      { menuItemId: 'i1', name: 'Paneer Tikka', quantity: 1, selectedOptions: [], lineTotal: { amount: 40000, currency: 'INR' } },
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

describe('Fulfillment failure & reassignment integration (Phase 5B)', () => {
  let repo: MongoFulfillmentRepository;
  let uow: MongoUnitOfWork;
  let outbox: MongoOutboxStore;
  let bus: InMemoryEventBus;

  let createFulfillment: CreateFulfillment;
  let markPreparing: MarkPreparing;
  let markReady: MarkReadyForPickup;
  let offer: OfferRiderAssignment;
  let accept: AcceptDelivery;
  let confirmPickup: ConfirmPickup;
  let reassign: ReassignRider;
  let fail: FailDelivery;
  let onOrderRequested: OnOrderRequested;

  beforeEach(() => {
    const txContext = new TransactionContext();
    repo = new MongoFulfillmentRepository(txContext);
    uow = new MongoUnitOfWork(getConnection(), txContext);
    outbox = new MongoOutboxStore(txContext);
    bus = new InMemoryEventBus();

    const service = new SimpleDeliveryAssignmentService(async () => [RIDER_1]);

    createFulfillment = new CreateFulfillment(repo, uow, outbox, bus);
    markPreparing = new MarkPreparing(repo, uow, outbox, bus);
    markReady = new MarkReadyForPickup(repo, uow, outbox, bus);
    offer = new OfferRiderAssignment(repo, service, uow, outbox, bus, 60);
    const assignRider = new AssignRider(repo, service, uow, outbox, bus, 60);
    accept = new AcceptDelivery(repo, uow, outbox, bus);
    confirmPickup = new ConfirmPickup(repo, uow, outbox, bus);
    reassign = new ReassignRider(repo, service, uow, outbox, bus, 60, assignRider);
    fail = new FailDelivery(repo, uow, outbox, bus);

    onOrderRequested = new OnOrderRequested(createFulfillment);
    bus.subscribe('OrderRequested', (e) => onOrderRequested.handle(e));
  });

  afterEach(async () => {
    await FulfillmentModel.deleteMany({});
    await OutboxEventModel.deleteMany({});
  });

  async function seedAssigned(): Promise<string> {
    const orderRequestId = `order-${randomUUID().slice(0, 8)}`;
    await onOrderRequested.handle(orderRequestedEvent(orderRequestId));
    const id = ((await repo.findByOrderRequestId(orderRequestId)) as Fulfillment).id.toString();
    await markPreparing.execute({ fulfillmentId: id, restaurantId: RESTAURANT_ID });
    await markReady.execute({ fulfillmentId: id, restaurantId: RESTAURANT_ID });
    await offer.execute({ fulfillmentId: id });
    await accept.execute({ fulfillmentId: id, riderId: RIDER_1 });
    return id;
  }

  it('reassigns an accepted delivery to a new rider, preserving history and emitting RiderReassigned once', async () => {
    const id = await seedAssigned();

    const result = await reassign.execute({ fulfillmentId: id, riderId: RIDER_2 });
    expect(result.isSuccess).toBe(true);

    const reloaded = (await repo.findById(id)) as Fulfillment;
    expect(reloaded.deliveryStatus.value).toBe(DELIVERY_STATUS.ASSIGNED);
    expect(reloaded.currentAssignment!.riderId).toBe(RIDER_2);
    expect(reloaded.currentAssignment!.status.value).toBe(RIDER_ASSIGNMENT_STATUS.ACCEPTED);
    expect(reloaded.currentAssignment!.attempt).toBe(2);
    expect(reloaded.assignmentHistory).toHaveLength(1);
    expect(reloaded.assignmentHistory[0].riderId).toBe(RIDER_1);
    expect(reloaded.assignmentHistory[0].status.value).toBe(RIDER_ASSIGNMENT_STATUS.REASSIGNED);

    expect(await OutboxEventModel.countDocuments({ eventName: 'RiderReassigned' })).toBe(1);
  });

  it('fails a picked-up delivery, persisting failureReason and emitting DeliveryFailed once', async () => {
    const id = await seedAssigned();
    await confirmPickup.execute({ fulfillmentId: id, riderId: RIDER_1 });

    const result = await fail.execute({
      fulfillmentId: id,
      riderId: RIDER_1,
      failureReason: FAILURE_REASON.CUSTOMER_UNAVAILABLE,
    });
    expect(result.isSuccess).toBe(true);

    const reloaded = (await repo.findById(id)) as Fulfillment;
    expect(reloaded.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.FAILED);
    expect(reloaded.fulfillmentStatus.isTerminal()).toBe(true);
    expect(reloaded.deliveryStatus.value).toBe(DELIVERY_STATUS.FAILED);
    expect(reloaded.failureReason).toBe(FAILURE_REASON.CUSTOMER_UNAVAILABLE);

    expect(await OutboxEventModel.countDocuments({ eventName: 'DeliveryFailed' })).toBe(1);
  });
});
