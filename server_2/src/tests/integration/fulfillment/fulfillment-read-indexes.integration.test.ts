import { AdminDashboardViewModel } from '../../../infrastructure/database/models/AdminDashboardViewModel';
import { RiderQueueViewModel } from '../../../infrastructure/database/models/RiderQueueViewModel';
import { RestaurantFulfillmentViewModel } from '../../../infrastructure/database/models/RestaurantFulfillmentViewModel';
import { CustomerTrackingViewModel } from '../../../infrastructure/database/models/CustomerTrackingViewModel';

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

describe('Batch 9.2 — fulfillment read-model index coverage', () => {
  beforeAll(async () => {
    await Promise.all([
      AdminDashboardViewModel.syncIndexes(),
      RiderQueueViewModel.syncIndexes(),
      RestaurantFulfillmentViewModel.syncIndexes(),
      CustomerTrackingViewModel.syncIndexes(),
    ]);

    const now = Date.now();
    const statuses = ['CREATED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'];
    const adminDocs = Array.from({ length: 120 }, (_, i) => ({
      _id: `f-${i}`,
      orderRequestId: `or-${i}`,
      customerId: `cust-${i % 7}`,
      restaurantId: `rest-${i % 5}`,
      status: statuses[i % statuses.length],
      deliveryStatus: 'UNASSIGNED',
      riderId: null,
      createdAt: new Date(now - i * 1000),
      updatedAt: new Date(now - i * 1000),
      slaBreached: i % 3 === 0,
      exceptionFlag: false,
      cancellation: null,
      failureReason: null,
      total: money,
    }));
    await AdminDashboardViewModel.insertMany(adminDocs);

    const riderDocs = Array.from({ length: 60 }, (_, i) => ({
      _id: `rider-${i % 4}:f-${i}`,
      riderId: `rider-${i % 4}`,
      fulfillmentId: `f-${i}`,
      assignmentStatus: i % 2 === 0 ? 'OFFERED' : 'ACCEPTED',
      attempt: 1,
      expiresAt: null,
      restaurantId: `rest-${i % 5}`,
      deliveryAddress: { street: 's', city: 'c', state: 'st', pinCode: '1', coordinates: { lat: 0, lng: 0 } },
      total: money,
      fulfillmentStatus: 'READY_FOR_PICKUP',
      offeredAt: new Date(now - i * 1000),
      updatedAt: new Date(now - i * 1000),
    }));
    await RiderQueueViewModel.insertMany(riderDocs);

    const restDocs = Array.from({ length: 60 }, (_, i) => ({
      _id: `f-${i}`,
      restaurantId: `rest-${i % 5}`,
      customerId: `cust-${i % 7}`,
      orderRequestId: `or-${i}`,
      status: statuses[i % statuses.length],
      prepEstimateMinutes: null,
      lines: [],
      total: money,
      createdAt: new Date(now - i * 1000),
      readyAt: null,
      updatedAt: new Date(now - i * 1000),
    }));
    await RestaurantFulfillmentViewModel.insertMany(restDocs);

    const trackingDocs = Array.from({ length: 60 }, (_, i) => ({
      _id: `f-${i}`,
      orderRequestId: `or-${i}`,
      customerId: `cust-${i % 7}`,
      restaurantId: `rest-${i % 5}`,
      currentStatus: statuses[i % statuses.length],
      deliveryStatus: 'UNASSIGNED',
      riderId: null,
      timeline: [],
      processedEventIds: [],
      deliveryAddress: { street: 's', city: 'c', state: 'st', pinCode: '1', coordinates: { lat: 0, lng: 0 } },
      total: money,
      cancellation: null,
      failureReason: null,
      updatedAt: new Date(now - i * 1000),
    }));
    await CustomerTrackingViewModel.insertMany(trackingDocs);
  }, 120000);

  afterAll(async () => {
    await Promise.all([
      AdminDashboardViewModel.deleteMany({}),
      RiderQueueViewModel.deleteMany({}),
      RestaurantFulfillmentViewModel.deleteMany({}),
    ]);
  });

  describe('AdminDashboardView (findAdminDashboard)', () => {
    it('status filter + createdAt sort is index-backed with no in-memory SORT', async () => {
      const stages = await winningStages(
        AdminDashboardViewModel.find({ status: 'PREPARING' }).sort({ createdAt: -1 }).skip(0).limit(50)
      );
      expect(stages).toContain('IXSCAN');
      expect(stages).not.toContain('SORT');
      expect(stages).not.toContain('COLLSCAN');
    });

    it('slaBreached filter + createdAt sort is index-backed with no in-memory SORT', async () => {
      const stages = await winningStages(
        AdminDashboardViewModel.find({ slaBreached: true }).sort({ createdAt: -1 }).limit(50)
      );
      expect(stages).toContain('IXSCAN');
      expect(stages).not.toContain('SORT');
    });

    it('restaurantId filter + createdAt sort is index-backed with no in-memory SORT', async () => {
      const stages = await winningStages(
        AdminDashboardViewModel.find({ restaurantId: 'rest-1' }).sort({ createdAt: -1 }).limit(50)
      );
      expect(stages).toContain('IXSCAN');
      expect(stages).not.toContain('SORT');
    });

    it('default (no filter) + createdAt sort is index-backed with no in-memory SORT', async () => {
      const stages = await winningStages(AdminDashboardViewModel.find({}).sort({ createdAt: -1 }).limit(50));
      expect(stages).toContain('IXSCAN');
      expect(stages).not.toContain('SORT');
    });
  });

  describe('RiderQueueView (findRiderQueue)', () => {
    it('riderId filter + offeredAt sort is index-backed with no in-memory SORT', async () => {
      const stages = await winningStages(
        RiderQueueViewModel.find({ riderId: 'rider-1' }).sort({ offeredAt: -1 })
      );
      expect(stages).toContain('IXSCAN');
      expect(stages).not.toContain('SORT');
    });
  });

  describe('RestaurantFulfillmentView (findRestaurantQueue)', () => {
    it('restaurantId + status filter + createdAt sort is index-backed with no in-memory SORT', async () => {
      const stages = await winningStages(
        RestaurantFulfillmentViewModel.find({ restaurantId: 'rest-1', status: 'PREPARING' }).sort({ createdAt: -1 })
      );
      expect(stages).toContain('IXSCAN');
      expect(stages).not.toContain('SORT');
    });
  });

  describe('CustomerTrackingView (findCustomerTracking)', () => {
    it('findById is served by the _id index (never a collection scan)', async () => {
      const stages = await winningStages(CustomerTrackingViewModel.find({ _id: 'f-1' }) as never);
      expect(stages).not.toContain('COLLSCAN');
    });
  });
});
