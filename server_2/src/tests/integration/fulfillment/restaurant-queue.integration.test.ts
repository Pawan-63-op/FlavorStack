import { randomUUID } from 'crypto';
import { DomainEvent } from '../../../domain/shared/DomainEvent';

import { getConnection } from '../../../infrastructure/database/connection';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoUnitOfWork } from '../../../infrastructure/database/MongoUnitOfWork';
import { MongoFulfillmentRepository } from '../../../infrastructure/repositories/FulfillmentRepository';
import { FulfillmentModel } from '../../../infrastructure/database/models/FulfillmentModel';
import { OutboxEventModel } from '../../../infrastructure/database/models/OutboxEventModel';
import { InMemoryEventBus } from '../../../application/shared/events/InMemoryEventBus';

import { CreateFulfillment } from '../../../application/fulfillment/use-cases/CreateFulfillment';
import { MarkPreparing } from '../../../application/fulfillment/use-cases/MarkPreparing';
import { CancelFulfillment } from '../../../application/fulfillment/use-cases/CancelFulfillment';
import { GetRestaurantFulfillments } from '../../../application/fulfillment/use-cases/GetRestaurantFulfillments';
import { OnOrderRequested } from '../../../application/fulfillment/event-handlers/OnOrderRequested';
import { makeStubRestaurantDirectory } from '../../mocks/fulfillment.mocks';
import { CANCELLED_BY } from '../../../domain/fulfillment/enums/cancelled-by.enum';

const RESTAURANT_ID = 'queue-rest-1';
const OTHER_RESTAURANT_ID = 'queue-rest-2';
const OWNER_ID = 'queue-owner-1';
const CUSTOMER_ID = 'queue-cust-1';

const ADDRESS = {
  label: 'Home',
  street: '12 MG Road',
  city: 'Bengaluru',
  state: 'Karnataka',
  pinCode: '560001',
  coordinates: { lat: 12.97, lng: 77.59 },
};

function orderRequestedEvent(orderRequestId: string, restaurantId: string): DomainEvent {
  return {
    eventId: randomUUID(),
    occurredOn: new Date(),
    eventName: 'OrderRequested',
    aggregateId: orderRequestId,
    customerId: CUSTOMER_ID,
    restaurantId,
    lines: [
      {
        menuItemId: 'i1',
        name: 'Paneer Tikka',
        quantity: 2,
        selectedOptions: [],
        lineTotal: { amount: 40000, currency: 'INR' },
      },
      {
        menuItemId: 'i2',
        name: 'Gelato',
        quantity: 1,
        selectedOptions: [],
        lineTotal: { amount: 9000, currency: 'INR' },
      },
    ],
    pricing: { total: { amount: 49000, currency: 'INR' } },
    deliveryAddress: ADDRESS,
  } as unknown as DomainEvent;
}

async function cleanup(): Promise<void> {
  await Promise.all([FulfillmentModel.deleteMany({}), OutboxEventModel.deleteMany({})]);
}

/**
 * Owner prep-queue read path: `GET /restaurants/:restaurantId/fulfillments`.
 *
 * This endpoint had **no automated coverage at all** before Phase 3 Batch 2, which is
 * uncomfortable given it is the one owner-facing read the phase deliberately leaves on the
 * `fulfillments` aggregate while three sibling read models are deleted around it. These tests
 * pin the response contract (G18: line items + delivery address) so later batches cannot
 * regress it silently.
 *
 * Covers use case → repository → Mongo → response mapper. The HTTP plumbing above it
 * (params/query wiring) is covered by `unit/api/v1/controllers/FulfillmentController.test.ts`.
 */
describe('Restaurant fulfillment queue (GET /restaurants/:restaurantId/fulfillments)', () => {
  let repo: MongoFulfillmentRepository;
  let bus: InMemoryEventBus;
  let createFulfillment: CreateFulfillment;
  let markPreparing: MarkPreparing;
  let cancelFulfillment: CancelFulfillment;
  let getRestaurantFulfillments: GetRestaurantFulfillments;

  beforeAll(async () => {
    const connection = getConnection();
    const txContext = new TransactionContext();
    repo = new MongoFulfillmentRepository(txContext);
    const uow = new MongoUnitOfWork(connection, txContext);
    bus = new InMemoryEventBus();

    createFulfillment = new CreateFulfillment(repo, uow, bus);
    const restaurantDirectory = makeStubRestaurantDirectory(RESTAURANT_ID, OWNER_ID);
    markPreparing = new MarkPreparing(repo, restaurantDirectory, uow, bus);
    cancelFulfillment = new CancelFulfillment(repo, restaurantDirectory, uow, bus);
    getRestaurantFulfillments = new GetRestaurantFulfillments(repo);

    const onOrderRequested = new OnOrderRequested(createFulfillment);
    bus.subscribe('OrderRequested', (e) => onOrderRequested.handle(e));
  });

  beforeEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  async function placeOrder(restaurantId = RESTAURANT_ID): Promise<string> {
    const orderRequestId = randomUUID();
    await bus.publishAll([orderRequestedEvent(orderRequestId, restaurantId)]);
    const fulfillment = await repo.findByOrderRequestId(orderRequestId);
    expect(fulfillment).not.toBeNull();
    return fulfillment!.id.toString();
  }

  it('returns line items and the delivery address for each queued fulfillment (G18)', async () => {
    const fid = await placeOrder();

    const result = await getRestaurantFulfillments.execute({ restaurantId: RESTAURANT_ID });

    expect(result.isSuccess).toBe(true);
    const rows = result.getValue();
    expect(rows).toHaveLength(1);

    const row = rows[0];
    expect(row.fulfillmentId).toBe(fid);
    expect(row.restaurantId).toBe(RESTAURANT_ID);
    expect(row.customerId).toBe(CUSTOMER_ID);
    expect(row.status).toBe('CREATED');
    expect(row.total).toEqual({ amount: 49000, currency: 'INR' });

    // The two fields the owner Queue card renders — the actual G18 payload.
    expect(row.lines).toHaveLength(2);
    expect(row.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ menuItemId: 'i1', name: 'Paneer Tikka', quantity: 2 }),
        expect.objectContaining({ menuItemId: 'i2', name: 'Gelato', quantity: 1 }),
      ])
    );
    expect(row.lines[0].lineTotal).toEqual({ amount: 40000, currency: 'INR' });

    expect(row.deliveryAddress).toEqual(
      expect.objectContaining({
        label: 'Home',
        street: '12 MG Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        pinCode: '560001',
      })
    );
  });

  it('scopes results to the requested restaurant', async () => {
    const mine = await placeOrder(RESTAURANT_ID);
    await placeOrder(OTHER_RESTAURANT_ID);

    const rows = (await getRestaurantFulfillments.execute({ restaurantId: RESTAURANT_ID })).getValue();

    expect(rows.map((r) => r.fulfillmentId)).toEqual([mine]);
  });

  it('returns an empty array for a restaurant with no fulfillments', async () => {
    const rows = (await getRestaurantFulfillments.execute({ restaurantId: 'no-such-restaurant' })).getValue();
    expect(rows).toEqual([]);
  });

  it('narrows the queue to a single status when the status filter is supplied', async () => {
    const preparingId = await placeOrder();
    const createdId = await placeOrder();

    await markPreparing.execute({
      fulfillmentId: preparingId,
      actorUserId: OWNER_ID,
      prepEstimateMinutes: 15,
    });

    const preparing = (
      await getRestaurantFulfillments.execute({ restaurantId: RESTAURANT_ID, status: 'PREPARING' })
    ).getValue();
    expect(preparing.map((r) => r.fulfillmentId)).toEqual([preparingId]);
    expect(preparing[0].status).toBe('PREPARING');

    const created = (
      await getRestaurantFulfillments.execute({ restaurantId: RESTAURANT_ID, status: 'CREATED' })
    ).getValue();
    expect(created.map((r) => r.fulfillmentId)).toEqual([createdId]);

    // Unfiltered still returns both.
    const all = (await getRestaurantFulfillments.execute({ restaurantId: RESTAURANT_ID })).getValue();
    expect(all).toHaveLength(2);
  });

  it('returns an empty array for a status no fulfillment is in', async () => {
    await placeOrder();
    const rows = (
      await getRestaurantFulfillments.execute({ restaurantId: RESTAURANT_ID, status: 'DELIVERED' })
    ).getValue();
    expect(rows).toEqual([]);
  });

  it('orders the queue newest-first', async () => {
    const first = await placeOrder();
    const second = await placeOrder();
    const third = await placeOrder();

    const rows = (await getRestaurantFulfillments.execute({ restaurantId: RESTAURANT_ID })).getValue();

    expect(rows).toHaveLength(3);
    // createdAt is serialised to an ISO string by the response mapper, which sorts lexically.
    const timestamps = rows.map((r) => r.createdAt);
    expect(timestamps).toEqual([...timestamps].sort().reverse());
    expect(rows.map((r) => r.fulfillmentId).sort()).toEqual([first, second, third].sort());
  });

  /**
   * Behaviour pin, not an endorsement. `IFulfillmentRepository.findActiveByRestaurant` filters
   * on `restaurantId` (+ optional status) only — it never excludes terminal states, so an
   * unfiltered owner queue accumulates CANCELLED / DELIVERED rows forever despite the method
   * name. The frontend only ever requests a specific status, which is why this has gone
   * unnoticed. Recorded here so that changing it is a deliberate, visible decision.
   */
  it('still returns terminal fulfillments when unfiltered — findActiveByRestaurant is not active-only', async () => {
    const cancelledId = await placeOrder();

    await cancelFulfillment.execute({
      fulfillmentId: cancelledId,
      cancelledBy: CANCELLED_BY.CUSTOMER,
      reason: 'Changed mind',
      actorId: CUSTOMER_ID,
    });

    const rows = (await getRestaurantFulfillments.execute({ restaurantId: RESTAURANT_ID })).getValue();

    expect(rows.map((r) => r.fulfillmentId)).toContain(cancelledId);
    expect(rows.find((r) => r.fulfillmentId === cancelledId)?.status).toBe('CANCELLED');
  });
});
