import { randomUUID } from 'crypto';
import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { Fulfillment } from '../../../domain/fulfillment/entities/Fulfillment';
import { FULFILLMENT_STATUS } from '../../../domain/fulfillment/enums/fulfillment-status.enum';
import { CANCELLED_BY } from '../../../domain/fulfillment/enums/cancelled-by.enum';

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
import { AcceptDelivery } from '../../../application/fulfillment/use-cases/AcceptDelivery';
import { ConfirmPickup } from '../../../application/fulfillment/use-cases/ConfirmPickup';
import { CancelFulfillment } from '../../../application/fulfillment/use-cases/CancelFulfillment';
import { OnOrderRequested } from '../../../application/fulfillment/event-handlers/OnOrderRequested';

const CUSTOMER_ID = 'cust-1';
const RESTAURANT_ID = 'rest-1';
const RIDER_ID = 'rider-1';

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

describe('Fulfillment cancellation integration (Phase 5A)', () => {
  let txContext: TransactionContext;
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
  let cancel: CancelFulfillment;
  let onOrderRequested: OnOrderRequested;

  beforeEach(() => {
    txContext = new TransactionContext();
    repo = new MongoFulfillmentRepository(txContext);
    uow = new MongoUnitOfWork(getConnection(), txContext);
    outbox = new MongoOutboxStore(txContext);
    bus = new InMemoryEventBus();

    const service = new SimpleDeliveryAssignmentService(async () => [RIDER_ID]);

    createFulfillment = new CreateFulfillment(repo, uow, outbox, bus);
    markPreparing = new MarkPreparing(repo, uow, outbox, bus);
    markReady = new MarkReadyForPickup(repo, uow, outbox, bus);
    offer = new OfferRiderAssignment(repo, service, uow, outbox, bus, 60);
    accept = new AcceptDelivery(repo, uow, outbox, bus);
    confirmPickup = new ConfirmPickup(repo, uow, outbox, bus);
    cancel = new CancelFulfillment(repo, uow, outbox, bus);

    onOrderRequested = new OnOrderRequested(createFulfillment);
    bus.subscribe('OrderRequested', (e) => onOrderRequested.handle(e));
  });

  afterEach(async () => {
    await FulfillmentModel.deleteMany({});
    await OutboxEventModel.deleteMany({});
  });

  it('cancels a CREATED fulfillment, persists CancellationInfo and emits FulfillmentCancelled once', async () => {
    const orderRequestId = `order-${randomUUID().slice(0, 8)}`;
    await onOrderRequested.handle(orderRequestedEvent(orderRequestId));
    const id = ((await repo.findByOrderRequestId(orderRequestId)) as Fulfillment).id.toString();

    const result = await cancel.execute({
      fulfillmentId: id,
      cancelledBy: CANCELLED_BY.CUSTOMER,
      reason: 'changed my mind',
      actorId: CUSTOMER_ID,
    });
    expect(result.isSuccess).toBe(true);
    expect(result.getValue().status).toBe(FULFILLMENT_STATUS.CANCELLED);

    const reloaded = (await repo.findById(id)) as Fulfillment;
    expect(reloaded.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.CANCELLED);
    expect(reloaded.fulfillmentStatus.isTerminal()).toBe(true);
    expect(reloaded.cancellation).not.toBeNull();
    expect(reloaded.cancellation!.cancelledBy).toBe(CANCELLED_BY.CUSTOMER);
    expect(reloaded.cancellation!.reason).toBe('changed my mind');

    expect(await OutboxEventModel.countDocuments({ eventName: 'FulfillmentCancelled' })).toBe(1);
  });

  it('blocks cancellation once the order is PICKED_UP', async () => {
    const orderRequestId = `order-${randomUUID().slice(0, 8)}`;
    await onOrderRequested.handle(orderRequestedEvent(orderRequestId));
    const id = ((await repo.findByOrderRequestId(orderRequestId)) as Fulfillment).id.toString();

    await markPreparing.execute({ fulfillmentId: id, restaurantId: RESTAURANT_ID });
    await markReady.execute({ fulfillmentId: id, restaurantId: RESTAURANT_ID });
    await offer.execute({ fulfillmentId: id });
    await accept.execute({ fulfillmentId: id, riderId: RIDER_ID });
    await confirmPickup.execute({ fulfillmentId: id, riderId: RIDER_ID });

    const result = await cancel.execute({
      fulfillmentId: id,
      cancelledBy: CANCELLED_BY.SYSTEM,
      reason: 'too late',
    });
    expect(result.isFailure).toBe(true);

    const reloaded = (await repo.findById(id)) as Fulfillment;
    expect(reloaded.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.PICKED_UP);
    expect(reloaded.cancellation).toBeNull();
    expect(await OutboxEventModel.countDocuments({ eventName: 'FulfillmentCancelled' })).toBe(0);
  });
});
