import { randomUUID } from 'crypto';
import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { Fulfillment } from '../../../domain/fulfillment/entities/Fulfillment';
import { FULFILLMENT_STATUS } from '../../../domain/fulfillment/enums/fulfillment-status.enum';
import { DELIVERY_STATUS } from '../../../domain/fulfillment/enums/delivery-status.enum';

import { getConnection } from '../../../infrastructure/database/connection';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoUnitOfWork } from '../../../infrastructure/database/MongoUnitOfWork';
import { MongoFulfillmentRepository } from '../../../infrastructure/repositories/FulfillmentRepository';
import { SimpleDeliveryAssignmentService } from '../../../infrastructure/services/SimpleDeliveryAssignmentService';
import { FulfillmentModel } from '../../../infrastructure/database/models/FulfillmentModel';
import { OutboxEventModel } from '../../../infrastructure/database/models/OutboxEventModel';
import { createEventBusSpy, EventBusSpy, countPublished } from '../../mocks/shared.mocks';

import { CreateFulfillment } from '../../../application/fulfillment/use-cases/CreateFulfillment';
import { MarkPreparing } from '../../../application/fulfillment/use-cases/MarkPreparing';
import { MarkReadyForPickup } from '../../../application/fulfillment/use-cases/MarkReadyForPickup';
import { makeStubRestaurantDirectory } from '../../mocks/fulfillment.mocks';
import { OfferRiderAssignment } from '../../../application/fulfillment/use-cases/OfferRiderAssignment';
import { AcceptDelivery } from '../../../application/fulfillment/use-cases/AcceptDelivery';
import { ConfirmPickup } from '../../../application/fulfillment/use-cases/ConfirmPickup';
import { StartDelivery } from '../../../application/fulfillment/use-cases/StartDelivery';
import { CompleteDelivery } from '../../../application/fulfillment/use-cases/CompleteDelivery';
import { OnOrderRequested } from '../../../application/fulfillment/event-handlers/OnOrderRequested';
import { OnReadyForPickup } from '../../../application/fulfillment/event-handlers/OnReadyForPickup';

const RESTAURANT_ID = 'rest-1';
const OWNER_ID = 'owner-1';
const RIDER_ID = 'rider-1';

/** A published-shape OrderRequested as it arrives on the in-process bus (aggregateId = orderRequestId). */
function orderRequestedEvent(orderRequestId: string): DomainEvent {
  return {
    eventId: randomUUID(),
    occurredOn: new Date(),
    eventName: 'OrderRequested',
    aggregateId: orderRequestId,
    customerId: 'cust-1',
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

describe('Fulfillment delivery lifecycle e2e (Phase 4): OrderRequested → Delivered', () => {
  let txContext: TransactionContext;
  let repo: MongoFulfillmentRepository;
  let uow: MongoUnitOfWork;
  let bus: EventBusSpy;

  let createFulfillment: CreateFulfillment;
  let markPreparing: MarkPreparing;
  let markReady: MarkReadyForPickup;
  let accept: AcceptDelivery;
  let confirmPickup: ConfirmPickup;
  let startDelivery: StartDelivery;
  let completeDelivery: CompleteDelivery;
  let onOrderRequested: OnOrderRequested;

  beforeEach(() => {
    txContext = new TransactionContext();
    repo = new MongoFulfillmentRepository(txContext);
    uow = new MongoUnitOfWork(getConnection(), txContext);
    bus = createEventBusSpy();

    const service = new SimpleDeliveryAssignmentService(async () => [RIDER_ID]);

    createFulfillment = new CreateFulfillment(repo, uow, bus);
    const restaurantDirectory = makeStubRestaurantDirectory(RESTAURANT_ID, OWNER_ID);
    markPreparing = new MarkPreparing(repo, restaurantDirectory, uow, bus);
    markReady = new MarkReadyForPickup(repo, restaurantDirectory, uow, bus);
    const offer = new OfferRiderAssignment(repo, service, uow, bus, 60);
    accept = new AcceptDelivery(repo, uow, bus);
    confirmPickup = new ConfirmPickup(repo, uow, bus);
    startDelivery = new StartDelivery(repo, uow, bus);
    completeDelivery = new CompleteDelivery(repo, uow, bus);

    onOrderRequested = new OnOrderRequested(createFulfillment);
    const onReady = new OnReadyForPickup(offer);
    bus.subscribe('OrderRequested', (e) => onOrderRequested.handle(e));
    bus.subscribe('ReadyForPickup', (e) => onReady.handle(e));
  });

  afterEach(async () => {
    await FulfillmentModel.deleteMany({});
    await OutboxEventModel.deleteMany({});
  });

  it('walks the full happy path to DELIVERED, emitting every lifecycle event to the outbox', async () => {
    const orderRequestId = `order-${randomUUID().slice(0, 8)}`;

    await onOrderRequested.handle(orderRequestedEvent(orderRequestId));

    const created = (await repo.findByOrderRequestId(orderRequestId)) as Fulfillment;
    expect(created).not.toBeNull();
    expect(created.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.CREATED);
    const id = created.id.toString();

    expect((await markPreparing.execute({ fulfillmentId: id, actorUserId: OWNER_ID })).isSuccess).toBe(true);

    expect((await markReady.execute({ fulfillmentId: id, actorUserId: OWNER_ID })).isSuccess).toBe(true);

    const accepted = await accept.execute({ fulfillmentId: id, riderId: RIDER_ID });
    expect(accepted.isSuccess).toBe(true);
    expect(accepted.getValue().deliveryStatus).toBe(DELIVERY_STATUS.ASSIGNED);

    const pickup = await confirmPickup.execute({ fulfillmentId: id, riderId: RIDER_ID });
    expect(pickup.isSuccess).toBe(true);
    expect(pickup.getValue().status).toBe(FULFILLMENT_STATUS.PICKED_UP);

    const out = await startDelivery.execute({ fulfillmentId: id, riderId: RIDER_ID });
    expect(out.isSuccess).toBe(true);
    expect(out.getValue().status).toBe(FULFILLMENT_STATUS.OUT_FOR_DELIVERY);

    const delivered = await completeDelivery.execute({ fulfillmentId: id, riderId: RIDER_ID });
    expect(delivered.isSuccess).toBe(true);
    expect(delivered.getValue().status).toBe(FULFILLMENT_STATUS.DELIVERED);

    const reloaded = (await repo.findById(id)) as Fulfillment;
    expect(reloaded.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.DELIVERED);
    expect(reloaded.deliveryStatus.value).toBe(DELIVERY_STATUS.DELIVERED);
    expect(reloaded.fulfillmentStatus.isTerminal()).toBe(true);
    expect(reloaded.deliveredAt).toBeInstanceOf(Date);
    expect(reloaded.pickedUpAt).toBeInstanceOf(Date);

    for (const eventName of [
      'FulfillmentCreated',
      'PreparationStarted',
      'ReadyForPickup',
      'RiderOffered',
      'RiderAssigned',
      'PickupConfirmed',
      'OutForDelivery',
      'DeliveryCompleted',
    ]) {
      expect(countPublished(bus, eventName)).toBe(1);
    }
  });

  it('blocks pickup until food is READY_FOR_PICKUP and a rider has ACCEPTED', async () => {
    const orderRequestId = `order-${randomUUID().slice(0, 8)}`;
    await onOrderRequested.handle(orderRequestedEvent(orderRequestId));
    const id = ((await repo.findByOrderRequestId(orderRequestId)) as Fulfillment).id.toString();

    expect((await confirmPickup.execute({ fulfillmentId: id, riderId: RIDER_ID })).isFailure).toBe(true);

    await markPreparing.execute({ fulfillmentId: id, actorUserId: OWNER_ID });
    await markReady.execute({ fulfillmentId: id, actorUserId: OWNER_ID });

    expect((await confirmPickup.execute({ fulfillmentId: id, riderId: RIDER_ID })).isFailure).toBe(true);

    await accept.execute({ fulfillmentId: id, riderId: RIDER_ID });
    expect((await confirmPickup.execute({ fulfillmentId: id, riderId: RIDER_ID })).isSuccess).toBe(true);
  });
});
