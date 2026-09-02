import { CustomerTrackingViewModel } from '../../../infrastructure/database/models/CustomerTrackingViewModel';
import { FulfillmentModel } from '../../../infrastructure/database/models/FulfillmentModel';

/**
 * Index coverage for the fulfillment read paths.
 *
 * **On `syncIndexes()` vs `createIndexes()` in `beforeAll`.** Both `beforeAll` blocks below use
 * `syncIndexes()`, and that is deliberate — do not "fix" it back to `createIndexes()`. `explain()`
 * can only pick a plan from indexes that exist *at query time*, and Mongoose's `autoIndex` build is
 * fire-and-forget, so a suite that does not await an index build races it and fails intermittently
 * with a spurious COLLSCAN. `syncIndexes()` awaits the build **and** drops indexes no longer
 * declared on the schema, which `createIndexes()` does not — so it is the stricter of the two here:
 * a stale index left over from a previous run cannot rescue a query whose supporting index was
 * deleted. It is a superset of what the note asked for, not a shortfall.
 *
 * **Coverage.** Every index added in Phases 2–3 is asserted somewhere:
 * - the five Phase 3 `fulfillments` indexes (`createdAt`, `fulfillmentStatus+createdAt`,
 *   `restaurantId+createdAt`, `currentAssignment.riderId+offeredAt`,
 *   `currentAssignment.riderId+fulfillmentStatus+deliveredAt`) — in this file;
 * - `customer_tracking_views {customerId, updatedAt}` — in this file;
 * - the Phase 2 `menu_items {restaurantId, deletedAt}` — in
 *   `catalog/catalog-menu-read.integration.test.ts` ("serves the menu item query from an index"),
 *   which also uses `syncIndexes()`. It is asserted next to the read it serves rather than
 *   duplicated here.
 */

function collectStages(plan: Record<string, unknown> | undefined): string[] {
  if (!plan) return [];
  const stages: string[] = [];
  if (typeof plan.stage === 'string') stages.push(plan.stage);
  if (plan.inputStage) stages.push(...collectStages(plan.inputStage as Record<string, unknown>));
  if (Array.isArray(plan.inputStages)) {
    for (const s of plan.inputStages) stages.push(...collectStages(s as Record<string, unknown>));
  }
  return stages;
}

async function winningStages(cursor: { explain: (v: string) => Promise<unknown> }): Promise<string[]> {
  const result = (await cursor.explain('queryPlanner')) as { queryPlanner?: { winningPlan?: Record<string, unknown> } };
  return collectStages(result.queryPlanner?.winningPlan);
}

const money = { amount: 50000, currency: 'INR' };

/**
 * The customer tracking view is the one fulfillment projection Phase 3 kept, so it is the only one
 * with index coverage left here. The retired rider_queue_views / admin_dashboard_views assertions
 * moved onto the `fulfillments` aggregate in the suite below.
 */
describe('CustomerTrackingView index coverage', () => {
  beforeAll(async () => {
    await CustomerTrackingViewModel.syncIndexes();

    const now = Date.now();
    const statuses = ['CREATED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'];
    const trackingDocs = Array.from({ length: 60 }, (_, i) => ({
      _id: `f-${i}`,
      orderRequestId: `or-${i}`,
      customerId: `cust-${i % 7}`,
      restaurantId: `rest-${i % 5}`,
      currentStatus: statuses[i % statuses.length],
      deliveryStatus: 'UNASSIGNED',
      riderId: null,
      timeline: [],
      deliveryAddress: { street: 's', city: 'c', state: 'st', pinCode: '1', coordinates: { lat: 0, lng: 0 } },
      total: money,
      cancellation: null,
      failureReason: null,
      updatedAt: new Date(now - i * 1000),
    }));
    await CustomerTrackingViewModel.insertMany(trackingDocs);
  }, 120000);

  afterAll(async () => {
    await CustomerTrackingViewModel.deleteMany({});
  });

  it('findById is served by the _id index (never a collection scan)', async () => {
    const stages = await winningStages(CustomerTrackingViewModel.find({ _id: 'f-1' }) as never);
    expect(stages).not.toContain('COLLSCAN');
  });

  it('findByCustomer (customerId + updatedAt sort) is index-backed with no in-memory SORT', async () => {
    const stages = await winningStages(
      CustomerTrackingViewModel.find({ customerId: 'cust-1' }).sort({ updatedAt: -1 }).limit(50)
    );
    expect(stages).toContain('IXSCAN');
    expect(stages).not.toContain('SORT');
    expect(stages).not.toContain('COLLSCAN');
  });
});

const ACTIVE_STATUS_FILTER = { $nin: ['DELIVERED', 'CANCELLED', 'FAILED'] };
const LIVE_ASSIGNMENT_FILTER = { $in: ['OFFERED', 'ACCEPTED'] };

/**
 * Phase 3 Batch 1: the same read shapes, answered by the `fulfillments` aggregate instead of the
 * rider_queue_views / admin_dashboard_views projections. Each query below is the one a later batch
 * repoints a use case at, so an IXSCAN here is the precondition for retiring the projection.
 */
describe('Phase 3 Batch 1 — fulfillments aggregate read-path index coverage', () => {
  const address = { street: 's', city: 'c', state: 'st', pinCode: '1', coordinates: { lat: 0, lng: 0 } };
  const activeStatuses = ['CREATED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'];

  beforeAll(async () => {
    await FulfillmentModel.syncIndexes();

    const now = Date.now();
    const assignmentFor = (riderId: string, status: string, offeredAt: Date) => ({
      id: `asg-${riderId}-${offeredAt.getTime()}`,
      riderId,
      status,
      attempt: 1,
      offeredAt,
      acceptedAt: status === 'ACCEPTED' ? offeredAt : null,
      respondedAt: null,
      expiresAt: new Date(offeredAt.getTime() + 60_000),
    });

    // 0-79 are live orders, most of them carrying an OFFERED/ACCEPTED assignment so every rider has a
    // non-empty queue; 80-119 are DELIVERED and keep their ACCEPTED assignment, which is what rider
    // delivery history reads.
    const docs = Array.from({ length: 120 }, (_, i) => {
      const at = new Date(now - i * 1000);
      const riderId = `rider-${i % 4}`;
      const delivered = i >= 80;
      const hasAssignment = delivered || i % 5 !== 0;
      const assignmentStatus = !delivered && i % 8 === 1 ? 'OFFERED' : 'ACCEPTED';
      return {
        _id: `fa-${i}`,
        orderRequestId: `ora-${i}`,
        customerId: `cust-${i % 7}`,
        restaurantId: `rest-${i % 5}`,
        lines: [],
        deliveryAddress: address,
        pricingTotal: money,
        fulfillmentStatus: delivered ? 'DELIVERED' : activeStatuses[i % activeStatuses.length],
        deliveryStatus: delivered ? 'DELIVERED' : 'UNASSIGNED',
        currentAssignment: hasAssignment ? assignmentFor(riderId, assignmentStatus, at) : null,
        assignmentHistory: [],
        cancellation: null,
        failureReason: null,
        createdAt: at,
        updatedAt: at,
        deliveredAt: delivered ? at : undefined,
        version: 1,
      };
    });
    await FulfillmentModel.insertMany(docs);
  }, 120000);

  afterAll(async () => {
    await FulfillmentModel.deleteMany({});
  });

  describe('admin dashboard (findAdminDashboard)', () => {
    it('default (no filter) + createdAt sort is index-backed with no in-memory SORT', async () => {
      const stages = await winningStages(FulfillmentModel.find({}).sort({ createdAt: -1 }).limit(50));
      expect(stages).toContain('IXSCAN');
      expect(stages).not.toContain('SORT');
      expect(stages).not.toContain('COLLSCAN');
    });

    it('status filter + createdAt sort is index-backed with no in-memory SORT', async () => {
      const stages = await winningStages(
        FulfillmentModel.find({ fulfillmentStatus: 'PREPARING' }).sort({ createdAt: -1 }).skip(0).limit(50)
      );
      expect(stages).toContain('IXSCAN');
      expect(stages).not.toContain('SORT');
      expect(stages).not.toContain('COLLSCAN');
    });

    it('restaurantId filter + createdAt sort is index-backed with no in-memory SORT', async () => {
      const stages = await winningStages(
        FulfillmentModel.find({ restaurantId: 'rest-1' }).sort({ createdAt: -1 }).limit(50)
      );
      expect(stages).toContain('IXSCAN');
      expect(stages).not.toContain('SORT');
      expect(stages).not.toContain('COLLSCAN');
    });
  });

  describe('analytics (aggregateAnalytics $match)', () => {
    it('owner-scoped restaurantId + createdAt window is index-backed', async () => {
      const stages = await winningStages(
        FulfillmentModel.find({
          restaurantId: { $in: ['rest-1', 'rest-2'] },
          createdAt: { $gte: new Date(Date.now() - 60 * 86_400_000), $lte: new Date() },
        })
      );
      expect(stages).toContain('IXSCAN');
      expect(stages).not.toContain('COLLSCAN');
    });

    it('platform-scoped delivered leg over the createdAt window is index-backed', async () => {
      const stages = await winningStages(
        FulfillmentModel.find({
          fulfillmentStatus: 'DELIVERED',
          createdAt: { $gte: new Date(Date.now() - 60 * 86_400_000), $lte: new Date() },
        })
      );
      expect(stages).toContain('IXSCAN');
      expect(stages).not.toContain('COLLSCAN');
    });
  });

  describe('rider queue (findRiderQueue)', () => {
    it('active assignments for a rider + offeredAt sort is index-backed with no in-memory SORT', async () => {
      const stages = await winningStages(
        FulfillmentModel.find({
          'currentAssignment.riderId': 'rider-1',
          'currentAssignment.status': LIVE_ASSIGNMENT_FILTER,
          fulfillmentStatus: ACTIVE_STATUS_FILTER,
        }).sort({ 'currentAssignment.offeredAt': -1 })
      );
      expect(stages).toContain('IXSCAN');
      expect(stages).not.toContain('SORT');
      expect(stages).not.toContain('COLLSCAN');
    });
  });

  describe('rider delivery history (findRiderCompletedDeliveries)', () => {
    it('delivered fulfillments for a rider + deliveredAt sort is index-backed with no in-memory SORT', async () => {
      const stages = await winningStages(
        FulfillmentModel.find({ 'currentAssignment.riderId': 'rider-1', fulfillmentStatus: 'DELIVERED' })
          .sort({ deliveredAt: -1 })
          .limit(50)
      );
      expect(stages).toContain('IXSCAN');
      expect(stages).not.toContain('SORT');
      expect(stages).not.toContain('COLLSCAN');
    });
  });
});
