import { GetDashboardAnalytics } from '../../../../application/fulfillment/use-cases/GetDashboardAnalytics';
import {
  AnalyticsAggregate,
  IFulfillmentProjectionRepository,
} from '../../../../domain/fulfillment/repositories/IFulfillmentProjectionRepository';
import { IRestaurantDirectory } from '../../../../application/fulfillment/ports/IRestaurantDirectory';

function aggFixture(overrides: Partial<AnalyticsAggregate> = {}): AnalyticsAggregate {
  return {
    totalOrders: 10,
    deliveredCount: 6,
    deliveredRevenue: 150000,
    statusBreakdown: [
      { status: 'DELIVERED', count: 6 },
      { status: 'CANCELLED', count: 2 },
      { status: 'PREPARING', count: 1 },
      { status: 'OUT_FOR_DELIVERY', count: 1 },
    ],
    revenueByDay: [
      { date: '2026-06-22', amount: 120000 },
      { date: '2026-06-23', amount: 30000 },
    ],
    topRestaurants: [
      { restaurantId: 'r1', revenue: 80000, orders: 2 },
      { restaurantId: 'r2', revenue: 70000, orders: 1 },
    ],
    prevTotalOrders: 8,
    prevDeliveredRevenue: 100000,
    ...overrides,
  };
}

function makeRepo(agg: AnalyticsAggregate = aggFixture()): {
  repo: IFulfillmentProjectionRepository;
  aggregateAnalytics: jest.Mock;
} {
  const aggregateAnalytics = jest.fn().mockResolvedValue(agg);
  return { repo: { aggregateAnalytics } as unknown as IFulfillmentProjectionRepository, aggregateAnalytics };
}

function makeDirectory(overrides: Partial<jest.Mocked<IRestaurantDirectory>> = {}): jest.Mocked<IRestaurantDirectory> {
  return {
    getOwnerId: jest.fn(),
    listRestaurantIdsByOwner: jest.fn().mockResolvedValue([]),
    getRestaurantNames: jest.fn().mockResolvedValue({}),
    countAll: jest.fn().mockResolvedValue(0),
    ...overrides,
  } as jest.Mocked<IRestaurantDirectory>;
}

const FIXED_NOW = new Date('2026-06-28T12:00:00Z');

describe('GetDashboardAnalytics', () => {
  it('maps the aggregate to a platform-wide response (no restaurant filter)', async () => {
    const { repo, aggregateAnalytics } = makeRepo();
    const directory = makeDirectory({
      countAll: jest.fn().mockResolvedValue(5),
      getRestaurantNames: jest.fn().mockResolvedValue({ r1: 'Demo Diner', r2: 'Checkout Diner' }),
    });
    const uc = new GetDashboardAnalytics(repo, directory, () => FIXED_NOW);

    const result = await uc.execute({ scope: 'PLATFORM', windowDays: 30 });

    expect(result.isFailure).toBe(false);
    const v = result.getValue();
    expect(v.scope).toBe('PLATFORM');
    expect(v.windowDays).toBe(30);
    expect(v.currency).toBe('INR');
    expect(v.cards).toEqual({
      revenue: { amount: 150000, currency: 'INR' },
      totalOrders: 10,
      activeOrders: 2, // PREPARING + OUT_FOR_DELIVERY (DELIVERED/CANCELLED/FAILED excluded)
      avgOrderValue: { amount: 25000, currency: 'INR' },
      delivered: 6,
      cancelled: 2,
      restaurantCount: 5,
      revenueTrendPct: 50,
      ordersTrendPct: 25,
    });
    expect(v.statusBreakdown).toEqual({ DELIVERED: 6, CANCELLED: 2, PREPARING: 1, OUT_FOR_DELIVERY: 1 });
    expect(v.revenueByDay).toEqual([
      { date: '2026-06-22', amount: 120000 },
      { date: '2026-06-23', amount: 30000 },
    ]);
    expect(v.topRestaurants).toEqual([
      { restaurantId: 'r1', name: 'Demo Diner', revenue: { amount: 80000, currency: 'INR' }, orders: 2 },
      { restaurantId: 'r2', name: 'Checkout Diner', revenue: { amount: 70000, currency: 'INR' }, orders: 1 },
    ]);
    expect(aggregateAnalytics).toHaveBeenCalledWith(expect.objectContaining({ restaurantIds: undefined }));
    expect(directory.listRestaurantIdsByOwner).not.toHaveBeenCalled();
  });

  it('scopes to the owner restaurants and resolves their names', async () => {
    const { repo, aggregateAnalytics } = makeRepo(
      aggFixture({ topRestaurants: [{ restaurantId: 'r1', revenue: 80000, orders: 2 }] })
    );
    const directory = makeDirectory({
      listRestaurantIdsByOwner: jest.fn().mockResolvedValue(['r1', 'r2']),
      getRestaurantNames: jest.fn().mockResolvedValue({ r1: 'Demo Diner' }),
    });
    const uc = new GetDashboardAnalytics(repo, directory, () => FIXED_NOW);

    const v = (await uc.execute({ scope: 'OWNER', ownerId: 'owner-1', windowDays: 30 })).getValue();

    expect(v.scope).toBe('OWNER');
    expect(v.cards.restaurantCount).toBe(2);
    expect(directory.listRestaurantIdsByOwner).toHaveBeenCalledWith('owner-1');
    expect(aggregateAnalytics).toHaveBeenCalledWith(expect.objectContaining({ restaurantIds: ['r1', 'r2'] }));
    expect(v.topRestaurants).toEqual([
      { restaurantId: 'r1', name: 'Demo Diner', revenue: { amount: 80000, currency: 'INR' }, orders: 2 },
    ]);
  });

  it('falls back to the restaurantId when a top-restaurant name is missing', async () => {
    const { repo } = makeRepo(aggFixture({ topRestaurants: [{ restaurantId: 'r9', revenue: 1000, orders: 1 }] }));
    const directory = makeDirectory({ countAll: jest.fn().mockResolvedValue(1) });
    const uc = new GetDashboardAnalytics(repo, directory, () => FIXED_NOW);

    const v = (await uc.execute({ scope: 'PLATFORM' })).getValue();

    expect(v.topRestaurants[0].name).toBe('r9');
  });

  it('returns an all-zero response for an owner with no restaurants without querying the projection', async () => {
    const { repo, aggregateAnalytics } = makeRepo();
    const directory = makeDirectory({ listRestaurantIdsByOwner: jest.fn().mockResolvedValue([]) });
    const uc = new GetDashboardAnalytics(repo, directory, () => FIXED_NOW);

    const v = (await uc.execute({ scope: 'OWNER', ownerId: 'owner-x' })).getValue();

    expect(v.cards.restaurantCount).toBe(0);
    expect(v.cards.totalOrders).toBe(0);
    expect(v.cards.revenue).toEqual({ amount: 0, currency: 'INR' });
    expect(v.cards.avgOrderValue).toEqual({ amount: 0, currency: 'INR' });
    expect(v.cards.revenueTrendPct).toBeNull();
    expect(v.cards.ordersTrendPct).toBeNull();
    expect(v.statusBreakdown).toEqual({});
    expect(v.revenueByDay).toEqual([]);
    expect(v.topRestaurants).toEqual([]);
    expect(aggregateAnalytics).not.toHaveBeenCalled();
    expect(directory.getRestaurantNames).not.toHaveBeenCalled();
  });

  it('returns null trends when the previous window had zero activity', async () => {
    const { repo } = makeRepo(aggFixture({ prevDeliveredRevenue: 0, prevTotalOrders: 0 }));
    const directory = makeDirectory({ countAll: jest.fn().mockResolvedValue(1) });
    const uc = new GetDashboardAnalytics(repo, directory, () => FIXED_NOW);

    const v = (await uc.execute({ scope: 'PLATFORM' })).getValue();

    expect(v.cards.revenueTrendPct).toBeNull();
    expect(v.cards.ordersTrendPct).toBeNull();
  });

  it('computes current and previous windows from the clock and windowDays', async () => {
    const { repo, aggregateAnalytics } = makeRepo();
    const uc = new GetDashboardAnalytics(repo, makeDirectory(), () => FIXED_NOW);

    await uc.execute({ scope: 'PLATFORM', windowDays: 7 });

    const arg = aggregateAnalytics.mock.calls[0][0];
    expect(arg.to).toEqual(FIXED_NOW);
    expect(arg.from).toEqual(new Date('2026-06-21T12:00:00Z')); // now - 7d
    expect(arg.prevFrom).toEqual(new Date('2026-06-14T12:00:00Z')); // now - 14d
  });

  it('defaults the window to 30 days when omitted', async () => {
    const { repo, aggregateAnalytics } = makeRepo();
    const uc = new GetDashboardAnalytics(repo, makeDirectory(), () => FIXED_NOW);

    const v = (await uc.execute({ scope: 'PLATFORM' })).getValue();

    expect(v.windowDays).toBe(30);
    const arg = aggregateAnalytics.mock.calls[0][0];
    expect(arg.from).toEqual(new Date(FIXED_NOW.getTime() - 30 * 86_400_000));
  });

  it('fails when owner scope is requested without an ownerId', async () => {
    const { repo } = makeRepo();
    const uc = new GetDashboardAnalytics(repo, makeDirectory(), () => FIXED_NOW);

    const result = await uc.execute({ scope: 'OWNER' });

    expect(result.isFailure).toBe(true);
  });
});
