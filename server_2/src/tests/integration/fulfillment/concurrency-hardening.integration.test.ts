import { randomUUID } from 'crypto';
import { Fulfillment } from '../../../domain/fulfillment/entities/Fulfillment';
import { FulfillmentLine } from '../../../domain/fulfillment/value-objects/FulfillmentLine';
import { DeliveryAddress } from '../../../domain/fulfillment/value-objects/DeliveryAddress';
import { FULFILLMENT_STATUS } from '../../../domain/fulfillment/enums/fulfillment-status.enum';
import { DELIVERY_STATUS } from '../../../domain/fulfillment/enums/delivery-status.enum';
import { RIDER_ASSIGNMENT_STATUS } from '../../../domain/fulfillment/enums/rider-assignment-status.enum';
import { CANCELLED_BY } from '../../../domain/fulfillment/enums/cancelled-by.enum';
import { Money } from '../../../domain/shared/Money';
import { Result } from '../../../domain/shared/Result';
import { ConflictError } from '../../../domain/shared/errors/ConflictError';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';

import { getConnection } from '../../../infrastructure/database/connection';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoUnitOfWork } from '../../../infrastructure/database/MongoUnitOfWork';
import { MongoFulfillmentRepository } from '../../../infrastructure/repositories/FulfillmentRepository';
import { SimpleDeliveryAssignmentService } from '../../../infrastructure/services/SimpleDeliveryAssignmentService';
import { FulfillmentModel } from '../../../infrastructure/database/models/FulfillmentModel';
import { OutboxEventModel } from '../../../infrastructure/database/models/OutboxEventModel';
import { createEventBusSpy, EventBusSpy, countPublished } from '../../mocks/shared.mocks';

import { AcceptDelivery } from '../../../application/fulfillment/use-cases/AcceptDelivery';
import { AssignRider } from '../../../application/fulfillment/use-cases/AssignRider';
import { CancelFulfillment } from '../../../application/fulfillment/use-cases/CancelFulfillment';
import { makeStubRestaurantDirectory } from '../../mocks/fulfillment.mocks';
import { HandleAssignmentTimeout } from '../../../application/fulfillment/use-cases/HandleAssignmentTimeout';
import { HandleSlaTimeout } from '../../../application/fulfillment/use-cases/HandleSlaTimeout';

/** Assignment-attempt cap, enforced by AssignRider/ReassignRider since Phase 10.4. */
const MAX_ATTEMPTS = 3;

const CUSTOMER_ID = 'cust-1';
const RESTAURANT_ID = 'rest-1';
const OWNER_ID = 'owner-1';
const RIDER_1 = 'rider-1';
const RIDER_2 = 'rider-2';

function money(amount: number): Money {
  return Money.create(amount, 'INR').getValue();
}

function future(ms = 60_000): Date {
  return new Date(Date.now() + ms);
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
    customerId: CUSTOMER_ID,
    restaurantId: RESTAURANT_ID,
    lines: [line],
    deliveryAddress: address,
    pricingTotal: money(45000),
  }).getValue();
  f.pullDomainEvents();
  return f;
}

describe('Fulfillment concurrency hardening (Phase 9.3)', () => {
  let txContext: TransactionContext;
  let repo: MongoFulfillmentRepository;
  let uow: MongoUnitOfWork;
  let bus: EventBusSpy;

  beforeEach(() => {
    txContext = new TransactionContext();
    repo = new MongoFulfillmentRepository(txContext);
    uow = new MongoUnitOfWork(getConnection(), txContext);
    bus = createEventBusSpy();
  });

  afterEach(async () => {
    await FulfillmentModel.deleteMany({});
    await OutboxEventModel.deleteMany({});
  });

  async function step(id: string, mutate: (f: Fulfillment) => Result<void>): Promise<void> {
    const f = (await repo.findById(id)) as Fulfillment;
    const r = mutate(f);
    if (r.isFailure) throw new Error(`seed step failed: ${String(r.getError())}`);
    f.pullDomainEvents();
    await repo.update(f);
  }

  async function storedVersion(id: string): Promise<number> {
    const doc = await FulfillmentModel.findById(id).lean<{ version: number }>();
    return (doc as { version: number }).version;
  }

  async function seed(steps: Array<(f: Fulfillment) => Result<void>> = []): Promise<string> {
    const f = buildFulfillment();
    await repo.save(f);
    const id = f.id.toString();
    for (const s of steps) await step(id, s);
    return id;
  }

  describe('optimistic concurrency — conflicting transitions (deterministic two-reader)', () => {
    it('two accepts: exactly one commits, the loser throws ConflictError', async () => {
      const id = await seed([
        (f) => f.startPreparation(RESTAURANT_ID),
        (f) => f.markReadyForPickup(RESTAURANT_ID),
        (f) => f.offerToRider(RIDER_1, future()),
      ]);
      const baseVersion = await storedVersion(id);

      const a = (await repo.findById(id)) as Fulfillment;
      const b = (await repo.findById(id)) as Fulfillment;
      expect(a.acceptByRider(RIDER_1).isSuccess).toBe(true);
      expect(b.acceptByRider(RIDER_1).isSuccess).toBe(true);

      await repo.update(a); // winner
      await expect(repo.update(b)).rejects.toBeInstanceOf(ConflictError);

      const reloaded = (await repo.findById(id)) as Fulfillment;
      expect(reloaded.currentAssignment!.status.value).toBe(RIDER_ASSIGNMENT_STATUS.ACCEPTED);
      expect(reloaded.deliveryStatus.value).toBe(DELIVERY_STATUS.ASSIGNED);
      expect(await storedVersion(id)).toBe(baseVersion + 1); // exactly one bump
    });

    it('accept vs cancel: one wins, the other conflicts, no illegal state persisted', async () => {
      const id = await seed([
        (f) => f.startPreparation(RESTAURANT_ID),
        (f) => f.markReadyForPickup(RESTAURANT_ID),
        (f) => f.offerToRider(RIDER_1, future()),
      ]);
      const baseVersion = await storedVersion(id);

      const accepter = (await repo.findById(id)) as Fulfillment;
      const canceller = (await repo.findById(id)) as Fulfillment;
      expect(accepter.acceptByRider(RIDER_1).isSuccess).toBe(true);
      expect(canceller.cancel(CANCELLED_BY.RESTAURANT, 'kitchen closed', RESTAURANT_ID).isSuccess).toBe(true);

      await repo.update(accepter); // accept commits first
      await expect(repo.update(canceller)).rejects.toBeInstanceOf(ConflictError);

      const reloaded = (await repo.findById(id)) as Fulfillment;
      expect(reloaded.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.READY_FOR_PICKUP);
      expect(reloaded.currentAssignment!.status.value).toBe(RIDER_ASSIGNMENT_STATUS.ACCEPTED);
      expect(reloaded.cancellation).toBeNull();
      expect(await storedVersion(id)).toBe(baseVersion + 1);
    });

    it('double pickup: only one confirmPickup commits', async () => {
      const id = await seed([
        (f) => f.startPreparation(RESTAURANT_ID),
        (f) => f.markReadyForPickup(RESTAURANT_ID),
        (f) => f.offerToRider(RIDER_1, future()),
        (f) => f.acceptByRider(RIDER_1),
      ]);
      const baseVersion = await storedVersion(id);

      const a = (await repo.findById(id)) as Fulfillment;
      const b = (await repo.findById(id)) as Fulfillment;
      expect(a.confirmPickup(RIDER_1).isSuccess).toBe(true);
      expect(b.confirmPickup(RIDER_1).isSuccess).toBe(true);

      await repo.update(a);
      await expect(repo.update(b)).rejects.toBeInstanceOf(ConflictError);

      const reloaded = (await repo.findById(id)) as Fulfillment;
      expect(reloaded.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.PICKED_UP);
      expect(reloaded.deliveryStatus.value).toBe(DELIVERY_STATUS.PICKED_UP);
      expect(await storedVersion(id)).toBe(baseVersion + 1);
    });

    it('double completion: only one completeDelivery commits', async () => {
      const id = await seed([
        (f) => f.startPreparation(RESTAURANT_ID),
        (f) => f.markReadyForPickup(RESTAURANT_ID),
        (f) => f.offerToRider(RIDER_1, future()),
        (f) => f.acceptByRider(RIDER_1),
        (f) => f.confirmPickup(RIDER_1),
        (f) => f.startDelivery(RIDER_1),
      ]);
      const baseVersion = await storedVersion(id);

      const a = (await repo.findById(id)) as Fulfillment;
      const b = (await repo.findById(id)) as Fulfillment;
      expect(a.completeDelivery(RIDER_1).isSuccess).toBe(true);
      expect(b.completeDelivery(RIDER_1).isSuccess).toBe(true);

      await repo.update(a);
      await expect(repo.update(b)).rejects.toBeInstanceOf(ConflictError);

      const reloaded = (await repo.findById(id)) as Fulfillment;
      expect(reloaded.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.DELIVERED);
      expect(reloaded.fulfillmentStatus.isTerminal()).toBe(true);
      expect(await storedVersion(id)).toBe(baseVersion + 1);
    });

    it('concurrent duplicate transition (two startPreparation): one wins, one conflicts', async () => {
      const id = await seed();
      const baseVersion = await storedVersion(id);

      const a = (await repo.findById(id)) as Fulfillment;
      const b = (await repo.findById(id)) as Fulfillment;
      expect(a.startPreparation(RESTAURANT_ID).isSuccess).toBe(true);
      expect(b.startPreparation(RESTAURANT_ID).isSuccess).toBe(true);

      await repo.update(a);
      await expect(repo.update(b)).rejects.toBeInstanceOf(ConflictError);

      const reloaded = (await repo.findById(id)) as Fulfillment;
      expect(reloaded.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.PREPARING);
      expect(await storedVersion(id)).toBe(baseVersion + 1);
    });
  });

  describe('genuine contention — two AcceptDelivery use cases fired concurrently', () => {
    it('exactly one accept succeeds; the loser fails cleanly (ConflictError or domain failure)', async () => {
      const id = await seed([
        (f) => f.startPreparation(RESTAURANT_ID),
        (f) => f.markReadyForPickup(RESTAURANT_ID),
        (f) => f.offerToRider(RIDER_1, future()),
      ]);
      const baseVersion = await storedVersion(id);

      const accept = new AcceptDelivery(repo, uow, bus);
      const settled = await Promise.allSettled([
        accept.execute({ fulfillmentId: id, riderId: RIDER_1 }),
        accept.execute({ fulfillmentId: id, riderId: RIDER_1 }),
      ]);

      const successes = settled.filter((s) => s.status === 'fulfilled' && s.value.isSuccess);
      const losers = settled.filter(
        (s) => (s.status === 'fulfilled' && s.value.isFailure) || s.status === 'rejected'
      );
      expect(successes).toHaveLength(1);
      expect(losers).toHaveLength(1);

      const rejected = settled.find((s) => s.status === 'rejected') as PromiseRejectedResult | undefined;
      if (rejected) expect(rejected.reason).toBeInstanceOf(ConflictError);

      const reloaded = (await repo.findById(id)) as Fulfillment;
      expect(reloaded.currentAssignment!.status.value).toBe(RIDER_ASSIGNMENT_STATUS.ACCEPTED);
      expect(await storedVersion(id)).toBe(baseVersion + 1); // single commit
      expect(countPublished(bus, 'RiderAssigned')).toBe(1);
    });
  });

  describe('"one non-terminal assignment at a time" invariant under contention', () => {
    it('two concurrent offers to different riders: only one active assignment persists', async () => {
      const id = await seed([
        (f) => f.startPreparation(RESTAURANT_ID),
        (f) => f.markReadyForPickup(RESTAURANT_ID),
      ]);
      const baseVersion = await storedVersion(id);

      const a = (await repo.findById(id)) as Fulfillment;
      const b = (await repo.findById(id)) as Fulfillment;
      expect(a.offerToRider(RIDER_1, future()).isSuccess).toBe(true);
      expect(b.offerToRider(RIDER_2, future()).isSuccess).toBe(true);

      await repo.update(a);
      await expect(repo.update(b)).rejects.toBeInstanceOf(ConflictError);

      const reloaded = (await repo.findById(id)) as Fulfillment;
      expect(reloaded.currentAssignment).not.toBeNull();
      expect(reloaded.currentAssignment!.riderId).toBe(RIDER_1);
      expect(reloaded.currentAssignment!.isActive()).toBe(true);
      expect(reloaded.assignmentHistory).toHaveLength(0); // no second assignment leaked anywhere
      expect(await storedVersion(id)).toBe(baseVersion + 1);
    });

    it('a fresh offer is rejected while an active offer exists (aggregate guard)', async () => {
      const id = await seed([
        (f) => f.startPreparation(RESTAURANT_ID),
        (f) => f.markReadyForPickup(RESTAURANT_ID),
        (f) => f.offerToRider(RIDER_1, future()),
      ]);

      const f = (await repo.findById(id)) as Fulfillment;
      const second = f.offerToRider(RIDER_2, future());
      expect(second.isFailure).toBe(true);
      expect(second.getError()).toBeInstanceOf(ConflictError);
    });
  });

  describe('replay safety — assignment-timeout job (HandleAssignmentTimeout)', () => {
    function buildTimeoutHandler(): HandleAssignmentTimeout {
      const service = new SimpleDeliveryAssignmentService(async () => []);
      const offer = new AssignRider(repo, service, uow, bus, 60, MAX_ATTEMPTS);
      const cancel = new CancelFulfillment(repo, makeStubRestaurantDirectory(RESTAURANT_ID, OWNER_ID), uow, bus);
      return new HandleAssignmentTimeout(repo, uow, bus, offer, cancel, 1);
    }

    it('first run expires the offer (and exhausts → cancels); a replay is a guarded no-op', async () => {
      const id = await seed([
        (f) => f.startPreparation(RESTAURANT_ID),
        (f) => f.markReadyForPickup(RESTAURANT_ID),
        (f) => f.offerToRider(RIDER_1, new Date(Date.now() + 5)), // attempt 1, expires almost immediately
      ]);
      await new Promise((resolve) => setTimeout(resolve, 25)); // let the offer TTL lapse
      const handler = buildTimeoutHandler();

      const first = await handler.execute({ fulfillmentId: id, attempt: 1 });
      expect(first.isSuccess).toBe(true);

      const afterFirst = (await repo.findById(id)) as Fulfillment;
      expect(afterFirst.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.CANCELLED); // exhausted → cancelled
      const versionAfterFirst = await storedVersion(id);
      // Phase 6 deleted `RiderAssignmentExpired` (zero subscribers); `assignmentHistory` is now the
      // observable proof that the expiry ran, and ran exactly once.
      expect(afterFirst.assignmentHistory.map((a) => a.status.value)).toEqual([RIDER_ASSIGNMENT_STATUS.EXPIRED]);

      const replay = await handler.execute({ fulfillmentId: id, attempt: 1 });
      expect(replay.isSuccess).toBe(true);
      expect(await storedVersion(id)).toBe(versionAfterFirst); // no further version bump
      const afterReplay = (await repo.findById(id)) as Fulfillment;
      expect(afterReplay.assignmentHistory.map((a) => a.status.value)).toEqual([RIDER_ASSIGNMENT_STATUS.EXPIRED]);
    });

    it('a stale-attempt timeout job on an already-accepted offer is a no-op', async () => {
      const id = await seed([
        (f) => f.startPreparation(RESTAURANT_ID),
        (f) => f.markReadyForPickup(RESTAURANT_ID),
        (f) => f.offerToRider(RIDER_1, future()),
        (f) => f.acceptByRider(RIDER_1),
      ]);
      const baseVersion = await storedVersion(id);
      const handler = buildTimeoutHandler();

      const result = await handler.execute({ fulfillmentId: id, attempt: 1 });
      expect(result.isSuccess).toBe(true);

      const reloaded = (await repo.findById(id)) as Fulfillment;
      expect(reloaded.currentAssignment!.status.value).toBe(RIDER_ASSIGNMENT_STATUS.ACCEPTED);
      expect(await storedVersion(id)).toBe(baseVersion); // untouched
      expect(reloaded.assignmentHistory).toHaveLength(0); // nothing was swept to history
    });
  });

  describe('replay safety — SLA-timeout job (HandleSlaTimeout)', () => {
    it('first run auto-cancels at the armed stage; a replay is a guarded no-op', async () => {
      const id = await seed([(f) => f.startPreparation(RESTAURANT_ID)]);
      const cancel = new CancelFulfillment(repo, makeStubRestaurantDirectory(RESTAURANT_ID, OWNER_ID), uow, bus);
      const handler = new HandleSlaTimeout(repo, cancel);

      const first = await handler.execute({ fulfillmentId: id, stage: FULFILLMENT_STATUS.PREPARING });
      expect(first.isSuccess).toBe(true);

      const afterFirst = (await repo.findById(id)) as Fulfillment;
      expect(afterFirst.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.CANCELLED);
      const versionAfterFirst = await storedVersion(id);
      expect(countPublished(bus, 'FulfillmentCancelled')).toBe(1);

      const replay = await handler.execute({ fulfillmentId: id, stage: FULFILLMENT_STATUS.PREPARING });
      expect(replay.isSuccess).toBe(true);
      expect(await storedVersion(id)).toBe(versionAfterFirst);
      expect(countPublished(bus, 'FulfillmentCancelled')).toBe(1);
    });

    it('SLA job whose stage was already advanced past is a no-op (SLA met)', async () => {
      const id = await seed([
        (f) => f.startPreparation(RESTAURANT_ID),
        (f) => f.markReadyForPickup(RESTAURANT_ID),
      ]);
      const baseVersion = await storedVersion(id);
      const cancel = new CancelFulfillment(repo, makeStubRestaurantDirectory(RESTAURANT_ID, OWNER_ID), uow, bus);
      const handler = new HandleSlaTimeout(repo, cancel);

      const result = await handler.execute({ fulfillmentId: id, stage: FULFILLMENT_STATUS.PREPARING });
      expect(result.isSuccess).toBe(true);

      const reloaded = (await repo.findById(id)) as Fulfillment;
      expect(reloaded.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.READY_FOR_PICKUP);
      expect(await storedVersion(id)).toBe(baseVersion);
      expect(countPublished(bus, 'FulfillmentCancelled')).toBe(0);
    });
  });

  describe('version monotonicity', () => {
    it('increments the persisted version by exactly one per successful transition', async () => {
      const id = await seed();
      expect(await storedVersion(id)).toBe(0);

      const transitions: Array<(f: Fulfillment) => Result<void>> = [
        (f) => f.startPreparation(RESTAURANT_ID),
        (f) => f.markReadyForPickup(RESTAURANT_ID),
        (f) => f.offerToRider(RIDER_1, future()),
        (f) => f.acceptByRider(RIDER_1),
        (f) => f.confirmPickup(RIDER_1),
        (f) => f.startDelivery(RIDER_1),
        (f) => f.completeDelivery(RIDER_1),
      ];

      let expected = 0;
      for (const t of transitions) {
        await step(id, t);
        expected += 1;
        expect(await storedVersion(id)).toBe(expected);
      }
      expect(expected).toBe(7);
    });
  });
});
