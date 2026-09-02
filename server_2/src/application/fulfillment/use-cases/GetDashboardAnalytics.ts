import { Result } from '../../../domain/shared/Result';
import { ValidationError } from '../../../domain/shared/errors/ValidationError';
import { FULFILLMENT_STATUS } from '../../../domain/fulfillment/enums/fulfillment-status.enum';
import {
  IFulfillmentQueryRepository,
  AnalyticsAggregate,
} from '../../../domain/fulfillment/repositories/IFulfillmentQueryRepository';
import { IRestaurantDirectory } from '../ports/IRestaurantDirectory';
import { GetDashboardAnalyticsDto } from '../dtos/GetDashboardAnalyticsDto';
import {
  DashboardAnalyticsResponse,
  DEFAULT_ANALYTICS_CURRENCY,
} from '../responses/DashboardAnalyticsResponse';

const DEFAULT_WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;
/** Statuses that are not "active" (a live, in-progress order). */
const TERMINAL_STATUSES = new Set<string>([
  FULFILLMENT_STATUS.DELIVERED,
  FULFILLMENT_STATUS.CANCELLED,
  FULFILLMENT_STATUS.FAILED,
]);

export class GetDashboardAnalytics {
  constructor(
    private readonly queryRepo: IFulfillmentQueryRepository,
    private readonly restaurantDirectory: IRestaurantDirectory,
    private readonly now: () => Date = () => new Date()
  ) {}

  async execute(dto: GetDashboardAnalyticsDto): Promise<Result<DashboardAnalyticsResponse>> {
    const windowDays = dto.windowDays ?? DEFAULT_WINDOW_DAYS;
    const to = this.now();
    const from = new Date(to.getTime() - windowDays * DAY_MS);
    const prevFrom = new Date(to.getTime() - 2 * windowDays * DAY_MS);

    let restaurantIds: string[] | undefined;
    let restaurantCount: number;
    if (dto.scope === 'OWNER') {
      if (!dto.ownerId) {
        return Result.fail(new ValidationError('ownerId is required for owner analytics'));
      }
      restaurantIds = await this.restaurantDirectory.listRestaurantIdsByOwner(dto.ownerId);
      restaurantCount = restaurantIds.length;
      if (restaurantIds.length === 0) {
        return Result.ok(this.emptyResponse(dto.scope, windowDays, restaurantCount));
      }
    } else {
      restaurantIds = undefined; // platform-wide
      restaurantCount = await this.restaurantDirectory.countAll();
    }

    const agg = await this.queryRepo.aggregateAnalytics({ restaurantIds, from, to, prevFrom });
    const response = await this.toResponse(dto.scope, windowDays, restaurantCount, agg);
    return Result.ok(response);
  }

  private async toResponse(
    scope: GetDashboardAnalyticsDto['scope'],
    windowDays: number,
    restaurantCount: number,
    agg: AnalyticsAggregate
  ): Promise<DashboardAnalyticsResponse> {
    const statusBreakdown: Record<string, number> = {};
    for (const bucket of agg.statusBreakdown) statusBreakdown[bucket.status] = bucket.count;

    const activeOrders = agg.statusBreakdown
      .filter((b) => !TERMINAL_STATUSES.has(b.status))
      .reduce((sum, b) => sum + b.count, 0);

    const cancelled = statusBreakdown[FULFILLMENT_STATUS.CANCELLED] ?? 0;
    const avgOrderValueAmount =
      agg.deliveredCount > 0 ? Math.round(agg.deliveredRevenue / agg.deliveredCount) : 0;

    const names =
      agg.topRestaurants.length > 0
        ? await this.restaurantDirectory.getRestaurantNames(agg.topRestaurants.map((r) => r.restaurantId))
        : {};

    return {
      scope,
      windowDays,
      currency: DEFAULT_ANALYTICS_CURRENCY,
      cards: {
        revenue: money(agg.deliveredRevenue),
        totalOrders: agg.totalOrders,
        activeOrders,
        avgOrderValue: money(avgOrderValueAmount),
        delivered: agg.deliveredCount,
        cancelled,
        restaurantCount,
        revenueTrendPct: trendPct(agg.deliveredRevenue, agg.prevDeliveredRevenue),
        ordersTrendPct: trendPct(agg.totalOrders, agg.prevTotalOrders),
      },
      statusBreakdown,
      revenueByDay: agg.revenueByDay.map((d) => ({ date: d.date, amount: d.amount })),
      topRestaurants: agg.topRestaurants.map((r) => ({
        restaurantId: r.restaurantId,
        name: names[r.restaurantId] ?? r.restaurantId,
        revenue: money(r.revenue),
        orders: r.orders,
      })),
    };
  }

  private emptyResponse(
    scope: GetDashboardAnalyticsDto['scope'],
    windowDays: number,
    restaurantCount: number
  ): DashboardAnalyticsResponse {
    return {
      scope,
      windowDays,
      currency: DEFAULT_ANALYTICS_CURRENCY,
      cards: {
        revenue: money(0),
        totalOrders: 0,
        activeOrders: 0,
        avgOrderValue: money(0),
        delivered: 0,
        cancelled: 0,
        restaurantCount,
        revenueTrendPct: null,
        ordersTrendPct: null,
      },
      statusBreakdown: {},
      revenueByDay: [],
      topRestaurants: [],
    };
  }
}

function money(amount: number): { amount: number; currency: string } {
  return { amount, currency: DEFAULT_ANALYTICS_CURRENCY };
}

/** Percent change vs the previous window, rounded to one decimal; null when prior is zero. */
function trendPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
