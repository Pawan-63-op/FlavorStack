import { randomUUID } from 'crypto';
import { DomainEvent } from '../../../domain/shared/DomainEvent';

import { getConnection } from '../../../infrastructure/database/connection';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoUnitOfWork } from '../../../infrastructure/database/MongoUnitOfWork';
import { MongoFulfillmentRepository } from '../../../infrastructure/repositories/FulfillmentRepository';
import { MongoFulfillmentQueryRepository } from '../../../infrastructure/repositories/FulfillmentQueryRepository';
import { SimpleDeliveryAssignmentService } from '../../../infrastructure/services/SimpleDeliveryAssignmentService';
import { FulfillmentModel } from '../../../infrastructure/database/models/FulfillmentModel';
import { OutboxEventModel } from '../../../infrastructure/database/models/OutboxEventModel';
import { CustomerTrackingViewModel } from '../../../infrastructure/database/models/CustomerTrackingViewModel';
import { InMemoryEventBus } from '../../../application/shared/events/InMemoryEventBus';

import { CreateFulfillment } from '../../../application/fulfillment/use-cases/CreateFulfillment';
import { MarkPreparing } from '../../../application/fulfillment/use-cases/MarkPreparing';
import { MarkReadyForPickup } from '../../../application/fulfillment/use-cases/MarkReadyForPickup';
import { AssignRider } from '../../../application/fulfillment/use-cases/AssignRider';
import { AcceptDelivery } from '../../../application/fulfillment/use-cases/AcceptDelivery';
import { RejectDelivery } from '../../../application/fulfillment/use-cases/RejectDelivery';
import { ConfirmPickup } from '../../../application/fulfillment/use-cases/ConfirmPickup';
import { StartDelivery } from '../../../application/fulfillment/use-cases/StartDelivery';
import { CompleteDelivery } from '../../../application/fulfillment/use-cases/CompleteDelivery';
import { CancelFulfillment } from '../../../application/fulfillment/use-cases/CancelFulfillment';
import { ReassignRider } from '../../../application/fulfillment/use-cases/ReassignRider';
import { GetRiderQueue } from '../../../application/fulfillment/use-cases/GetRiderQueue';
import { GetRiderDeliveryHistory } from '../../../application/fulfillment/use-cases/GetRiderDeliveryHistory';
import { OnOrderRequested } from '../../../application/fulfillment/event-handlers/OnOrderRequested';
import { makeStubRestaurantDirectory } from '../../mocks/fulfillment.mocks';
import { CANCELLED_BY } from '../../../domain/fulfillment/enums/cancelled-by.enum';

/** Assignment-attempt cap, enforced by AssignRider/ReassignRider since Phase 10.4. */
const MAX_ATTEMPTS = 3;

/**
 * Phase 3 / Batch 3 — the rider reads are served from the `fulfillments` aggregate
 * instead of `rider_queue_views` / `admin_dashboard_views`.
 *
 * Note what is deliberately **not** wired here: `FulfillmentProjector` is never
 * registered on the bus, so no read model is written at all during these tests. Every
 * assertion below therefore proves the query repository reads source of truth. It also
 * reproduces the exact condition under which the old projection dropped rider offers on
 * the floor (`onRiderOffered` read `customer_tracking_views` and silently returned when
 * the row was missing).
 */

const RESTAURANT_ID = 'rider-reads-rest-1';
const OWNER_ID = 'rider-reads-owner-1';
const CUSTOMER_ID = 'rider-reads-cust-1';
const RIDER_A = 'rider-reads-rider-a';
const RIDER_B = 'rider-reads-rider-b';
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
      label: 'Home',
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

describe('Rider reads off the fulfillment aggregate (Phase 3 / Batch 3)', () => {
  let repo: MongoFulfillmentRepository;
  let queryRepo: MongoFulfillmentQueryRepository;
  let bus: InMemoryEventBus;

  let markPreparing: MarkPreparing;
  let markReadyForPickup: MarkReadyForPickup;
  let assignRider: AssignRider;
  let acceptDelivery: AcceptDelivery;
  let rejectDelivery: RejectDelivery;
  let confirmPickup: ConfirmPickup;
  let startDelivery: StartDelivery;
  let completeDelivery: CompleteDelivery;
  let cancelFulfillment: CancelFulfillment;
  let reassignRider: ReassignRider;

  let getRiderQueue: GetRiderQueue;
  let getRiderDeliveryHistory: GetRiderDeliveryHistory;

  /** Riders the assignment service may pick, in order. Mutated per test. */
  let availableRiders: string[];

  beforeAll(async () => {
    const connection = getConnection();
    const txContext = new TransactionContext();
    repo = new MongoFulfillmentRepository(txContext);
    queryRepo = new MongoFulfillmentQueryRepository();
    const uow = new MongoUnitOfWork(connection, txContext);
    bus = new InMemoryEventBus();

    const assignmentService = new SimpleDeliveryAssignmentService(async () => availableRiders);
    const restaurantDirectory = makeStubRestaurantDirectory(RESTAURANT_ID, OWNER_ID);

    const createFulfillment = new CreateFulfillment(repo, uow, bus);
    markPreparing = new MarkPreparing(repo, restaurantDirectory, uow, bus);
    markReadyForPickup = new MarkReadyForPickup(repo, restaurantDirectory, uow, bus);
    assignRider = new AssignRider(repo, assignmentService, uow, bus, OFFER_TTL, MAX_ATTEMPTS);
    acceptDelivery = new AcceptDelivery(repo, uow, bus);
    rejectDelivery = new RejectDelivery(repo, uow, bus, assignRider);
    confirmPickup = new ConfirmPickup(repo, uow, bus);
    startDelivery = new StartDelivery(repo, uow, bus);
    completeDelivery = new CompleteDelivery(repo, uow, bus);
    cancelFulfillment = new CancelFulfillment(repo, restaurantDirectory, uow, bus);
    reassignRider = new ReassignRider(repo, assignmentService, uow, bus, OFFER_TTL, MAX_ATTEMPTS);

    getRiderQueue = new GetRiderQueue(queryRepo);
    getRiderDeliveryHistory = new GetRiderDeliveryHistory(queryRepo);

    // Only the order → fulfillment handler. No projector: nothing writes a read model.
    const onOrderRequested = new OnOrderRequested(createFulfillment);
    bus.subscribe('OrderRequested', (e) => onOrderRequested.handle(e));
  });

  beforeEach(async () => {
    availableRiders = [RIDER_A];
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  /**
   * Offers the fulfillment to a specific rider. `AssignRider` picks from the
   * assignment service rather than taking a rider id, so the candidate pool is narrowed
   * to the one rider we want for the assertion.
   */
  async function offerTo(fulfillmentId: string, riderId: string): Promise<void> {
    availableRiders = [riderId];
    const result = await assignRider.execute({ fulfillmentId });
    expect(result.isSuccess).toBe(true);
  }

  /** Drives OrderRequested → READY_FOR_PICKUP and returns the fulfillment id. */
  async function makeReadyFulfillment(): Promise<string> {
    const orderRequestId = randomUUID();
    await bus.publishAll([orderRequestedEvent(orderRequestId)]);
    const fulfillment = await repo.findByOrderRequestId(orderRequestId);
    const fid = fulfillment!.id.toString();
    await markPreparing.execute({ fulfillmentId: fid, actorUserId: OWNER_ID, prepEstimateMinutes: 15 });
    await markReadyForPickup.execute({ fulfillmentId: fid, actorUserId: OWNER_ID });
    return fid;
  }

  describe('findRiderQueue', () => {
    it('returns an offered assignment even though no tracking view exists (bug fix)', async () => {
      const fid = await makeReadyFulfillment();
      await offerTo(fid, RIDER_A);

      // Guard the premise: the projection this read used to depend on was never written.
      expect(await CustomerTrackingViewModel.countDocuments({})).toBe(0);

      const result = await getRiderQueue.execute({ riderId: RIDER_A });

      expect(result.isSuccess).toBe(true);
      const items = result.getValue();
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        fulfillmentId: fid,
        assignmentStatus: 'OFFERED',
        attempt: 1,
        restaurantId: RESTAURANT_ID,
        fulfillmentStatus: 'READY_FOR_PICKUP',
        total: { amount: 45000, currency: 'INR' },
      });
      expect(items[0].deliveryAddress.street).toBe('12 MG Road');
      expect(items[0].expiresAt).not.toBeNull();
    });

    it('flips the assignment to ACCEPTED and follows the fulfillment status through the leg', async () => {
      const fid = await makeReadyFulfillment();
      await offerTo(fid, RIDER_A);
      await acceptDelivery.execute({ fulfillmentId: fid, riderId: RIDER_A });

      let items = (await getRiderQueue.execute({ riderId: RIDER_A })).getValue();
      expect(items[0].assignmentStatus).toBe('ACCEPTED');
      expect(items[0].fulfillmentStatus).toBe('READY_FOR_PICKUP');

      await confirmPickup.execute({ fulfillmentId: fid, riderId: RIDER_A });
      items = (await getRiderQueue.execute({ riderId: RIDER_A })).getValue();
      expect(items[0].fulfillmentStatus).toBe('PICKED_UP');

      await startDelivery.execute({ fulfillmentId: fid, riderId: RIDER_A });
      items = (await getRiderQueue.execute({ riderId: RIDER_A })).getValue();
      expect(items[0].fulfillmentStatus).toBe('OUT_FOR_DELIVERY');
    });

    it('drops the delivery once DELIVERED, even though currentAssignment stays ACCEPTED', async () => {
      const fid = await makeReadyFulfillment();
      await offerTo(fid, RIDER_A);
      await acceptDelivery.execute({ fulfillmentId: fid, riderId: RIDER_A });
      await confirmPickup.execute({ fulfillmentId: fid, riderId: RIDER_A });
      await startDelivery.execute({ fulfillmentId: fid, riderId: RIDER_A });
      await completeDelivery.execute({ fulfillmentId: fid, riderId: RIDER_A });

      // The precondition that makes the terminal-status exclusion load-bearing.
      const delivered = await repo.findById(fid);
      expect(delivered!.currentAssignment?.status.value).toBe('ACCEPTED');

      expect((await getRiderQueue.execute({ riderId: RIDER_A })).getValue()).toHaveLength(0);
    });

    it('drops the delivery once CANCELLED', async () => {
      const fid = await makeReadyFulfillment();
      await offerTo(fid, RIDER_A);
      await acceptDelivery.execute({ fulfillmentId: fid, riderId: RIDER_A });

      await cancelFulfillment.execute({
        fulfillmentId: fid,
        cancelledBy: CANCELLED_BY.SYSTEM,
        reason: 'test cancellation',
      });

      expect((await getRiderQueue.execute({ riderId: RIDER_A })).getValue()).toHaveLength(0);
    });

    it('drops the offer when the rider rejects it', async () => {
      const fid = await makeReadyFulfillment();
      await offerTo(fid, RIDER_A);
      await rejectDelivery.execute({ fulfillmentId: fid, riderId: RIDER_A });

      expect((await getRiderQueue.execute({ riderId: RIDER_A })).getValue()).toHaveLength(0);
    });

    it('moves the delivery to the new rider on reassignment (bug fix)', async () => {
      const fid = await makeReadyFulfillment();
      await offerTo(fid, RIDER_A);
      await acceptDelivery.execute({ fulfillmentId: fid, riderId: RIDER_A });

      const reassigned = await reassignRider.execute({ fulfillmentId: fid, riderId: RIDER_B });
      expect(reassigned.isSuccess).toBe(true);

      // The old projection removed the previous rider's row but never created one for
      // the new rider, so RIDER_B's queue came back empty.
      const bItems = (await getRiderQueue.execute({ riderId: RIDER_B })).getValue();
      expect(bItems).toHaveLength(1);
      expect(bItems[0].fulfillmentId).toBe(fid);
      // `Fulfillment.reassign` offers *and* accepts in one step — a reassignment is an
      // admin-forced handover, not an offer the new rider can decline.
      expect(bItems[0].assignmentStatus).toBe('ACCEPTED');
      expect(bItems[0].attempt).toBe(2);

      expect((await getRiderQueue.execute({ riderId: RIDER_A })).getValue()).toHaveLength(0);
    });

    it('scopes to the requesting rider and orders newest offer first', async () => {
      const first = await makeReadyFulfillment();
      await offerTo(first, RIDER_A);
      const second = await makeReadyFulfillment();
      await offerTo(second, RIDER_A);
      const other = await makeReadyFulfillment();
      await offerTo(other, RIDER_B);

      const items = (await getRiderQueue.execute({ riderId: RIDER_A })).getValue();
      expect(items.map((i) => i.fulfillmentId)).toEqual([second, first]);
      expect((await getRiderQueue.execute({ riderId: RIDER_B })).getValue()).toHaveLength(1);
    });
  });

  describe('findRiderCompletedDeliveries', () => {
    /** Runs a full leg to DELIVERED for `riderId` and returns the fulfillment id. */
    async function deliver(riderId: string): Promise<string> {
      const fid = await makeReadyFulfillment();
      await offerTo(fid, riderId);
      await acceptDelivery.execute({ fulfillmentId: fid, riderId });
      await confirmPickup.execute({ fulfillmentId: fid, riderId });
      await startDelivery.execute({ fulfillmentId: fid, riderId });
      await completeDelivery.execute({ fulfillmentId: fid, riderId });
      return fid;
    }

    it("reports the aggregate's real deliveredAt, with earnings", async () => {
      const fid = await deliver(RIDER_A);
      const aggregate = await repo.findById(fid);

      const body = (await getRiderDeliveryHistory.execute({ riderId: RIDER_A })).getValue();

      expect(body.deliveries).toHaveLength(1);
      expect(body.deliveries[0]).toEqual({
        fulfillmentId: fid,
        restaurantId: RESTAURANT_ID,
        status: 'DELIVERED',
        total: { amount: 45000, currency: 'INR' },
        // 2500 base + 10% of 45000
        earning: { amount: 7000, currency: 'INR' },
        deliveredAt: aggregate!.deliveredAt!.toISOString(),
      });
      expect(body.summary).toEqual({
        totalDeliveries: 1,
        totalEarnings: { amount: 7000, currency: 'INR' },
      });
    });

    it('excludes in-flight deliveries and other riders, newest delivery first', async () => {
      const older = await deliver(RIDER_A);
      const newer = await deliver(RIDER_A);
      await deliver(RIDER_B);

      // An accepted-but-undelivered leg must not appear in history.
      const inFlight = await makeReadyFulfillment();
      await offerTo(inFlight, RIDER_A);
      await acceptDelivery.execute({ fulfillmentId: inFlight, riderId: RIDER_A });

      const body = (await getRiderDeliveryHistory.execute({ riderId: RIDER_A })).getValue();
      expect(body.deliveries.map((d) => d.fulfillmentId)).toEqual([newer, older]);
    });

    it('applies limit and offset', async () => {
      const older = await deliver(RIDER_A);
      const newer = await deliver(RIDER_A);

      const page1 = (await getRiderDeliveryHistory.execute({ riderId: RIDER_A, limit: 1 })).getValue();
      expect(page1.deliveries.map((d) => d.fulfillmentId)).toEqual([newer]);

      const page2 = (
        await getRiderDeliveryHistory.execute({ riderId: RIDER_A, limit: 1, offset: 1 })
      ).getValue();
      expect(page2.deliveries.map((d) => d.fulfillmentId)).toEqual([older]);
    });

    it('returns an empty history for a rider with no deliveries', async () => {
      const body = (await getRiderDeliveryHistory.execute({ riderId: 'nobody' })).getValue();
      expect(body.deliveries).toEqual([]);
      expect(body.summary.totalDeliveries).toBe(0);
    });
  });
});
