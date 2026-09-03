import { randomUUID } from 'crypto';
import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { Fulfillment } from '../../../domain/fulfillment/entities/Fulfillment';
import { FULFILLMENT_STATUS } from '../../../domain/fulfillment/enums/fulfillment-status.enum';
import { CANCELLED_BY } from '../../../domain/fulfillment/enums/cancelled-by.enum';

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
import { AssignRider } from '../../../application/fulfillment/use-cases/AssignRider';
import { AcceptDelivery } from '../../../application/fulfillment/use-cases/AcceptDelivery';
import { ConfirmPickup } from '../../../application/fulfillment/use-cases/ConfirmPickup';
import { CancelFulfillment } from '../../../application/fulfillment/use-cases/CancelFulfillment';
import { OnOrderRequested } from '../../../application/fulfillment/event-handlers/OnOrderRequested';

/** Assignment-attempt cap, enforced by AssignRider/ReassignRider since Phase 10.4. */
const MAX_ATTEMPTS = 3;

const CUSTOMER_ID = 'cust-1';
const RESTAURANT_ID = 'rest-1';
const OWNER_ID = 'owner-1';
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
  let bus: EventBusSpy;

  let createFulfillment: CreateFulfillment;
  let markPreparing: MarkPreparing;
  let markReady: MarkReadyForPickup;
  let offer: AssignRider;
  let accept: AcceptDelivery;
  let confirmPickup: ConfirmPickup;
  let cancel: CancelFulfillment;
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
    offer = new AssignRider(repo, service, uow, bus, 60, MAX_ATTEMPTS);
    accept = new AcceptDelivery(repo, uow, bus);
    confirmPickup = new ConfirmPickup(repo, uow, bus);
    cancel = new CancelFulfillment(repo, restaurantDirectory, uow, bus);

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

    expect(countPublished(bus, 'FulfillmentCancelled')).toBe(1);
  });

  it('blocks cancellation once the order is PICKED_UP', async () => {
    const orderRequestId = `order-${randomUUID().slice(0, 8)}`;
    await onOrderRequested.handle(orderRequestedEvent(orderRequestId));
    const id = ((await repo.findByOrderRequestId(orderRequestId)) as Fulfillment).id.toString();

    await markPreparing.execute({ fulfillmentId: id, actorUserId: OWNER_ID });
    await markReady.execute({ fulfillmentId: id, actorUserId: OWNER_ID });
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
    expect(countPublished(bus, 'FulfillmentCancelled')).toBe(0);
  });

  /**
   * The Phase 10.2 regression. `OWNER_ID !== RESTAURANT_ID` here on purpose: the controller used to
   * pass the owner's userId as the aggregate's `actorId`, which is compared against `restaurantId`,
   * so every real owner cancellation returned 403.
   */
  describe('actor-resolved cancellation', () => {
    async function seedCreated(): Promise<string> {
      const orderRequestId = `order-${randomUUID().slice(0, 8)}`;
      await onOrderRequested.handle(orderRequestedEvent(orderRequestId));
      return ((await repo.findByOrderRequestId(orderRequestId)) as Fulfillment).id.toString();
    }

    it('lets the restaurant owner cancel, though their userId differs from the restaurantId', async () => {
      expect(OWNER_ID).not.toBe(RESTAURANT_ID);
      const id = await seedCreated();

      const result = await cancel.execute({
        fulfillmentId: id,
        actorUserId: OWNER_ID,
        reason: 'kitchen closed',
      });

      expect(result.isSuccess).toBe(true);
      const reloaded = (await repo.findById(id)) as Fulfillment;
      expect(reloaded.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.CANCELLED);
      expect(reloaded.cancellation!.cancelledBy).toBe(CANCELLED_BY.RESTAURANT);
      expect(countPublished(bus, 'FulfillmentCancelled')).toBe(1);
    });

    it('lets the ordering customer cancel', async () => {
      const id = await seedCreated();

      const result = await cancel.execute({
        fulfillmentId: id,
        actorUserId: CUSTOMER_ID,
        reason: 'changed my mind',
      });

      expect(result.isSuccess).toBe(true);
      expect((await repo.findById(id))!.cancellation!.cancelledBy).toBe(CANCELLED_BY.CUSTOMER);
    });

    it('refuses a rider on the same fulfillment, leaving it untouched', async () => {
      const id = await seedCreated();

      const result = await cancel.execute({
        fulfillmentId: id,
        actorUserId: RIDER_ID,
        reason: 'not mine to cancel',
      });

      expect(result.isFailure).toBe(true);
      const reloaded = (await repo.findById(id)) as Fulfillment;
      expect(reloaded.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.CREATED);
      expect(reloaded.cancellation).toBeNull();
      expect(countPublished(bus, 'FulfillmentCancelled')).toBe(0);
    });
  });
});
