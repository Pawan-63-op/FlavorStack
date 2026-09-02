import { MongoFulfillmentQueryRepository } from '../../../infrastructure/repositories/FulfillmentQueryRepository';
import { AnalyticsQuery } from '../../../domain/fulfillment/repositories/IFulfillmentQueryRepository';
import { FulfillmentModel } from '../../../infrastructure/database/models/FulfillmentModel';

const R1 = 'an-rest-1';
const R2 = 'an-rest-2';

const TO = new Date('2026-06-28T12:00:00Z');
const FROM = new Date('2026-06-21T00:00:00Z');
const PREV_FROM = new Date('2026-06-14T00:00:00Z');

interface SeedView {
  id: string;
  restaurantId: string;
  status: string;
  amount: number;
  createdAt: string;
}

/** A `fulfillments` document — the analytics aggregation reads source of truth now. */
function seedDoc(v: SeedView): Record<string, unknown> {
  return {
    _id: v.id,
    orderRequestId: `or-${v.id}`,
    customerId: 'cust-1',
    restaurantId: v.restaurantId,
    lines: [],
    deliveryAddress: {
      street: 's',
      city: 'c',
      state: 'st',
      pinCode: '1',
      coordinates: { lat: 0, lng: 0 },
    },
    pricingTotal: { amount: v.amount, currency: 'INR' },
    fulfillmentStatus: v.status,
    deliveryStatus: 'UNASSIGNED',
    currentAssignment: null,
    assignmentHistory: [],
    cancellation: null,
    failureReason: null,
    createdAt: new Date(v.createdAt),
    updatedAt: new Date(v.createdAt),
    version: 0,
  };
}

const SEED: SeedView[] = [
  { id: 'd1', restaurantId: R1, status: 'DELIVERED', amount: 50000, createdAt: '2026-06-22T08:00:00Z' },
  { id: 'd2', restaurantId: R1, status: 'DELIVERED', amount: 30000, createdAt: '2026-06-23T08:00:00Z' },
  { id: 'd3', restaurantId: R2, status: 'DELIVERED', amount: 70000, createdAt: '2026-06-22T09:00:00Z' },
  { id: 'd4', restaurantId: R1, status: 'CANCELLED', amount: 20000, createdAt: '2026-06-24T08:00:00Z' },
  { id: 'd5', restaurantId: R2, status: 'PREPARING', amount: 40000, createdAt: '2026-06-25T08:00:00Z' },
  { id: 'd6', restaurantId: R1, status: 'OUT_FOR_DELIVERY', amount: 25000, createdAt: '2026-06-26T08:00:00Z' },
  { id: 'p1', restaurantId: R1, status: 'DELIVERED', amount: 10000, createdAt: '2026-06-16T08:00:00Z' },
  { id: 'p2', restaurantId: R2, status: 'DELIVERED', amount: 20000, createdAt: '2026-06-17T08:00:00Z' },
  { id: 'p3', restaurantId: R1, status: 'CREATED', amount: 5000, createdAt: '2026-06-18T08:00:00Z' },
  { id: 'o1', restaurantId: R1, status: 'DELIVERED', amount: 99999, createdAt: '2026-06-01T08:00:00Z' },
];

function statusMap(buckets: Array<{ status: string; count: number }>): Record<string, number> {
  return Object.fromEntries(buckets.map((b) => [b.status, b.count]));
}

describe('MongoFulfillmentQueryRepository.aggregateAnalytics (G13)', () => {
  const repo = new MongoFulfillmentQueryRepository();

  beforeAll(async () => {
    await FulfillmentModel.deleteMany({});
    await FulfillmentModel.insertMany(SEED.map(seedDoc));
  });

  afterAll(async () => {
    await FulfillmentModel.deleteMany({});
  });

  it('aggregates platform-wide (no restaurant filter)', async () => {
    const query: AnalyticsQuery = { from: FROM, to: TO, prevFrom: PREV_FROM };
    const agg = await repo.aggregateAnalytics(query);

    expect(agg.totalOrders).toBe(6);
    expect(agg.deliveredCount).toBe(3);
    expect(agg.deliveredRevenue).toBe(150000);

    expect(statusMap(agg.statusBreakdown)).toEqual({
      DELIVERED: 3,
      CANCELLED: 1,
      PREPARING: 1,
      OUT_FOR_DELIVERY: 1,
    });

    expect(agg.revenueByDay).toEqual([
      { date: '2026-06-22', amount: 120000 },
      { date: '2026-06-23', amount: 30000 },
    ]);

    expect(agg.topRestaurants).toEqual([
      { restaurantId: R1, revenue: 80000, orders: 2 },
      { restaurantId: R2, revenue: 70000, orders: 1 },
    ]);

    expect(agg.prevTotalOrders).toBe(3);
    expect(agg.prevDeliveredRevenue).toBe(30000);
  });

  it('scopes to a single owner restaurant', async () => {
    const query: AnalyticsQuery = { restaurantIds: [R1], from: FROM, to: TO, prevFrom: PREV_FROM };
    const agg = await repo.aggregateAnalytics(query);

    expect(agg.totalOrders).toBe(4); // d1,d2,d4,d6
    expect(agg.deliveredCount).toBe(2);
    expect(agg.deliveredRevenue).toBe(80000);
    expect(statusMap(agg.statusBreakdown)).toEqual({ DELIVERED: 2, CANCELLED: 1, OUT_FOR_DELIVERY: 1 });
    expect(agg.topRestaurants).toEqual([{ restaurantId: R1, revenue: 80000, orders: 2 }]);
    expect(agg.prevTotalOrders).toBe(2); // p1,p3
    expect(agg.prevDeliveredRevenue).toBe(10000); // p1
  });

  it('returns all-zero aggregates for an empty restaurant filter (owner with no restaurants)', async () => {
    const query: AnalyticsQuery = { restaurantIds: [], from: FROM, to: TO, prevFrom: PREV_FROM };
    const agg = await repo.aggregateAnalytics(query);

    expect(agg.totalOrders).toBe(0);
    expect(agg.deliveredCount).toBe(0);
    expect(agg.deliveredRevenue).toBe(0);
    expect(agg.statusBreakdown).toEqual([]);
    expect(agg.revenueByDay).toEqual([]);
    expect(agg.topRestaurants).toEqual([]);
    expect(agg.prevTotalOrders).toBe(0);
    expect(agg.prevDeliveredRevenue).toBe(0);
  });
});
