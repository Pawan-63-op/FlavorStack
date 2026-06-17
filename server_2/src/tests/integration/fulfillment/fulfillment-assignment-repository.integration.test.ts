import { randomUUID } from 'crypto';
import { Fulfillment } from '../../../domain/fulfillment/entities/Fulfillment';
import { FulfillmentLine } from '../../../domain/fulfillment/value-objects/FulfillmentLine';
import { DeliveryAddress } from '../../../domain/fulfillment/value-objects/DeliveryAddress';
import { RIDER_ASSIGNMENT_STATUS } from '../../../domain/fulfillment/enums/rider-assignment-status.enum';
import { Money } from '../../../domain/shared/Money';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoFulfillmentRepository } from '../../../infrastructure/repositories/FulfillmentRepository';
import { FulfillmentModel } from '../../../infrastructure/database/models/FulfillmentModel';

function money(amount: number): Money {
  return Money.create(amount, 'INR').getValue();
}

function buildFulfillment(): Fulfillment {
  const line = FulfillmentLine.create({
    menuItemId: 'item-1',
    name: 'Paneer Tikka',
    quantity: 1,
    selectedOptions: [],
    lineTotal: money(40000),
  }).getValue();
  const address = DeliveryAddress.create({
    street: '12 MG Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    pinCode: '560001',
    coordinates: GeoPoint.create(12.97, 77.59).getValue(),
  }).getValue();

  const f = Fulfillment.createFromOrderRequested({
    orderRequestId: `order-${randomUUID().slice(0, 8)}`,
    customerId: 'cust-1',
    restaurantId: 'rest-1',
    lines: [line],
    deliveryAddress: address,
    pricingTotal: money(45000),
  }).getValue();
  f.pullDomainEvents();
  return f;
}

function future(): Date {
  return new Date(Date.now() + 60_000);
}

describe('MongoFulfillmentRepository — rider assignment persistence', () => {
  let txContext: TransactionContext;
  let repo: MongoFulfillmentRepository;

  beforeEach(() => {
    txContext = new TransactionContext();
    repo = new MongoFulfillmentRepository(txContext);
  });

  afterEach(async () => {
    await FulfillmentModel.deleteMany({});
  });

  it('round-trips a current OFFERED assignment through update + findById', async () => {
    const f = buildFulfillment();
    await repo.save(f);

    const expiresAt = future();
    f.offerToRider('rider-1', expiresAt);
    await repo.update(f);

    const found = await repo.findById(f.id.toString());
    expect(found).toBeInstanceOf(Fulfillment);
    const reloaded = found as Fulfillment;

    expect(reloaded.currentAssignment).not.toBeNull();
    expect(reloaded.currentAssignment!.riderId).toBe('rider-1');
    expect(reloaded.currentAssignment!.attempt).toBe(1);
    expect(reloaded.currentAssignment!.status.value).toBe(RIDER_ASSIGNMENT_STATUS.OFFERED);
    expect(reloaded.currentAssignment!.expiresAt.getTime()).toBe(expiresAt.getTime());
    expect(reloaded.assignmentHistory).toHaveLength(0);
    expect(reloaded.pullDomainEvents()).toEqual([]);
  });

  it('persists an ACCEPTED assignment with acceptedAt/respondedAt stamps', async () => {
    const f = buildFulfillment();
    await repo.save(f);

    // Each transition follows the real use-case flow: load → mutate once → update
    // (the optimistic-concurrency guard keys on the version captured at load).
    f.offerToRider('rider-1', future());
    await repo.update(f);

    const offered = (await repo.findById(f.id.toString())) as Fulfillment;
    offered.acceptByRider('rider-1');
    await repo.update(offered);

    const reloaded = (await repo.findById(f.id.toString())) as Fulfillment;
    const a = reloaded.currentAssignment!;
    expect(a.status.value).toBe(RIDER_ASSIGNMENT_STATUS.ACCEPTED);
    expect(a.acceptedAt).toBeInstanceOf(Date);
    expect(a.respondedAt).toBeInstanceOf(Date);
  });

  it('persists a rejected attempt in assignmentHistory and a fresh OFFERED current', async () => {
    const f = buildFulfillment();
    await repo.save(f);

    f.offerToRider('rider-1', future());
    await repo.update(f);

    const offered = (await repo.findById(f.id.toString())) as Fulfillment;
    offered.rejectByRider('rider-1');
    await repo.update(offered);

    const rejected = (await repo.findById(f.id.toString())) as Fulfillment;
    rejected.offerToRider('rider-2', future());
    await repo.update(rejected);

    const reloaded = (await repo.findById(f.id.toString())) as Fulfillment;

    expect(reloaded.assignmentHistory).toHaveLength(1);
    expect(reloaded.assignmentHistory[0].riderId).toBe('rider-1');
    expect(reloaded.assignmentHistory[0].status.value).toBe(RIDER_ASSIGNMENT_STATUS.REJECTED);
    expect(reloaded.currentAssignment!.riderId).toBe('rider-2');
    expect(reloaded.currentAssignment!.attempt).toBe(2);
    expect(reloaded.currentAssignment!.status.value).toBe(RIDER_ASSIGNMENT_STATUS.OFFERED);
  });
});
