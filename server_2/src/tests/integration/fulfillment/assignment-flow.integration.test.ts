import { randomUUID } from 'crypto';
import { Fulfillment } from '../../../domain/fulfillment/entities/Fulfillment';
import { FulfillmentLine } from '../../../domain/fulfillment/value-objects/FulfillmentLine';
import { DeliveryAddress } from '../../../domain/fulfillment/value-objects/DeliveryAddress';
import { RIDER_ASSIGNMENT_STATUS } from '../../../domain/fulfillment/enums/rider-assignment-status.enum';
import { Money } from '../../../domain/shared/Money';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';

import { getConnection } from '../../../infrastructure/database/connection';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoUnitOfWork } from '../../../infrastructure/database/MongoUnitOfWork';
import { MongoFulfillmentRepository } from '../../../infrastructure/repositories/FulfillmentRepository';
import { SimpleDeliveryAssignmentService } from '../../../infrastructure/services/SimpleDeliveryAssignmentService';
import { FulfillmentModel } from '../../../infrastructure/database/models/FulfillmentModel';
import { OutboxEventModel } from '../../../infrastructure/database/models/OutboxEventModel';
import { createEventBusSpy, EventBusSpy, countPublished } from '../../mocks/shared.mocks';

import { MarkReadyForPickup } from '../../../application/fulfillment/use-cases/MarkReadyForPickup';
import { makeStubRestaurantDirectory } from '../../mocks/fulfillment.mocks';
import { OfferRiderAssignment } from '../../../application/fulfillment/use-cases/OfferRiderAssignment';
import { AcceptDelivery } from '../../../application/fulfillment/use-cases/AcceptDelivery';
import { RejectDelivery } from '../../../application/fulfillment/use-cases/RejectDelivery';
import { OnReadyForPickup } from '../../../application/fulfillment/event-handlers/OnReadyForPickup';

const RESTAURANT_ID = 'rest-1';
const OWNER_ID = 'owner-1';
const RIDER_POOL = ['rider-1', 'rider-2', 'rider-3'];

function money(n: number): Money {
  return Money.create(n, 'INR').getValue();
}

async function savePreparingFulfillment(repo: MongoFulfillmentRepository): Promise<Fulfillment> {
  const f = Fulfillment.createFromOrderRequested({
    orderRequestId: `order-${randomUUID().slice(0, 8)}`,
    customerId: 'cust-1',
    restaurantId: RESTAURANT_ID,
    lines: [
      FulfillmentLine.create({ menuItemId: 'i1', name: 'X', quantity: 1, selectedOptions: [], lineTotal: money(100) }).getValue(),
    ],
    deliveryAddress: DeliveryAddress.create({
      street: 'A',
      city: 'B',
      state: 'C',
      pinCode: '000001',
      coordinates: GeoPoint.create(0, 0).getValue(),
    }).getValue(),
    pricingTotal: money(100),
  }).getValue();
  f.startPreparation(RESTAURANT_ID);
  f.pullDomainEvents();
  await repo.save(f);
  return f;
}

describe('Fulfillment assignment flow (Phase 3B)', () => {
  let txContext: TransactionContext;
  let repo: MongoFulfillmentRepository;
  let uow: MongoUnitOfWork;
  let bus: EventBusSpy;
  let markReady: MarkReadyForPickup;
  let offer: OfferRiderAssignment;
  let accept: AcceptDelivery;
  let reject: RejectDelivery;

  beforeEach(() => {
    txContext = new TransactionContext();
    repo = new MongoFulfillmentRepository(txContext);
    uow = new MongoUnitOfWork(getConnection(), txContext);
    bus = createEventBusSpy();

    const service = new SimpleDeliveryAssignmentService(async () => [...RIDER_POOL]);

    offer = new OfferRiderAssignment(repo, service, uow, bus, 60);
    accept = new AcceptDelivery(repo, uow, bus);
    reject = new RejectDelivery(repo, uow, bus, offer);
    const restaurantDirectory = makeStubRestaurantDirectory(RESTAURANT_ID, OWNER_ID);
    markReady = new MarkReadyForPickup(repo, restaurantDirectory, uow, bus);

    const onReady = new OnReadyForPickup(offer);
    bus.subscribe('ReadyForPickup', (e) => onReady.handle(e));
  });

  afterEach(async () => {
    await FulfillmentModel.deleteMany({});
    await OutboxEventModel.deleteMany({});
  });

  it('auto-offers a rider when the restaurant marks ready, persisting the offer + outbox rows', async () => {
    const f = await savePreparingFulfillment(repo);

    await markReady.execute({ fulfillmentId: f.id.toString(), actorUserId: OWNER_ID });

    const reloaded = (await repo.findById(f.id.toString())) as Fulfillment;
    expect(reloaded.currentAssignment).not.toBeNull();
    expect(reloaded.currentAssignment!.riderId).toBe('rider-1');
    expect(reloaded.currentAssignment!.status.value).toBe(RIDER_ASSIGNMENT_STATUS.OFFERED);

    const ready = countPublished(bus, 'ReadyForPickup');
    const offered = countPublished(bus, 'RiderOffered');
    expect(ready).toBe(1);
    expect(offered).toBe(1);
  });

  it('accepts the auto-offer → ACCEPTED + RiderAssigned in the outbox', async () => {
    const f = await savePreparingFulfillment(repo);
    await markReady.execute({ fulfillmentId: f.id.toString(), actorUserId: OWNER_ID });

    const res = await accept.execute({ fulfillmentId: f.id.toString(), riderId: 'rider-1' });
    expect(res.isSuccess).toBe(true);

    const reloaded = (await repo.findById(f.id.toString())) as Fulfillment;
    expect(reloaded.currentAssignment!.status.value).toBe(RIDER_ASSIGNMENT_STATUS.ACCEPTED);
    expect(countPublished(bus, 'RiderAssigned')).toBe(1);
  });

  it('rejecting re-offers the next rider and preserves assignment history', async () => {
    const f = await savePreparingFulfillment(repo);
    await markReady.execute({ fulfillmentId: f.id.toString(), actorUserId: OWNER_ID });

    const res = await reject.execute({ fulfillmentId: f.id.toString(), riderId: 'rider-1' });
    expect(res.isSuccess).toBe(true);

    const reloaded = (await repo.findById(f.id.toString())) as Fulfillment;
    expect(reloaded.assignmentHistory).toHaveLength(1);
    expect(reloaded.assignmentHistory[0].riderId).toBe('rider-1');
    expect(reloaded.assignmentHistory[0].status.value).toBe(RIDER_ASSIGNMENT_STATUS.REJECTED);
    expect(reloaded.currentAssignment!.riderId).toBe('rider-2');
    expect(reloaded.currentAssignment!.attempt).toBe(2);
    expect(reloaded.currentAssignment!.status.value).toBe(RIDER_ASSIGNMENT_STATUS.OFFERED);

    expect(countPublished(bus, 'RiderOffered')).toBe(2);
  });
});
