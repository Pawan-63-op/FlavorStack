import { formatMoney } from "../format/money";

/**
 * Owner/Admin Overview analytics (Phase 15 / G13). Mirrors the server_2
 * `DashboardAnalyticsResponse` (fulfillment context, `GET /owner/analytics` &
 * `GET /admin/analytics`). Money amounts arrive in **minor units**; the adapter
 * divides by 100 and pre-formats for display, builds the last-7-days revenue
 * series, and folds the raw status counts into the six doughnut buckets.
 */

export interface AnalyticsMoney {
  amount: number;
  currency: string;
}

export interface DashboardAnalyticsCards {
  revenue: AnalyticsMoney;
  totalOrders: number;
  activeOrders: number;
  avgOrderValue: AnalyticsMoney;
  delivered: number;
  cancelled: number;
  restaurantCount: number;
  revenueTrendPct: number | null;
  ordersTrendPct: number | null;
}

export interface DashboardAnalyticsResponse {
  scope: "OWNER" | "PLATFORM";
  windowDays: number;
  currency: string;
  cards: DashboardAnalyticsCards;
  statusBreakdown: Record<string, number>;
  revenueByDay: Array<{ date: string; amount: number }>;
  topRestaurants: Array<{ restaurantId: string; name: string; revenue: AnalyticsMoney; orders: number }>;
}

export interface AnalyticsMoneyView {
  amount: number;
  currency: string;
  formatted: string;
}

export interface AnalyticsTopRestaurantView {
  restaurantId: string;
  name: string;
  revenue: AnalyticsMoneyView;
  orders: number;
}

export interface DashboardAnalyticsView {
  scope: "OWNER" | "PLATFORM";
  windowDays: number;
  currency: string;
  cards: {
    revenue: AnalyticsMoneyView;
    totalOrders: number;
    activeOrders: number;
    avgOrderValue: AnalyticsMoneyView;
    delivered: number;
    cancelled: number;
    restaurantCount: number;
    revenueTrendPct: number | null;
    ordersTrendPct: number | null;
  };
  statusChart: Array<{ label: string; value: number }>;
  revenueSeries: { labels: string[]; values: number[] };
  topRestaurants: AnalyticsTopRestaurantView[];
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Display buckets for the status doughnut — maps the real fulfillment statuses to six labels. */
const STATUS_BUCKETS: Array<{ label: string; statuses: string[] }> = [
  { label: "Created", statuses: ["CREATED"] },
  { label: "Preparing", statuses: ["PREPARING"] },
  { label: "Ready", statuses: ["READY_FOR_PICKUP", "PICKED_UP"] },
  { label: "Out for delivery", statuses: ["OUT_FOR_DELIVERY"] },
  { label: "Delivered", statuses: ["DELIVERED"] },
  { label: "Cancelled", statuses: ["CANCELLED", "FAILED"] },
];

/** Minor units → major units, with a pre-formatted string. */
function toMoneyView(money: AnalyticsMoney): AnalyticsMoneyView {
  const amount = money.amount / 100;
  return { amount, currency: money.currency, formatted: formatMoney({ amount, currency: money.currency }) };
}

/** Last 7 UTC days ending at `now`: weekday labels + ÷100, zero-filled values. */
function buildRevenueSeries(
  byDay: DashboardAnalyticsResponse["revenueByDay"],
  now: Date,
): { labels: string[]; values: number[] } {
  const byDate = new Map(byDay.map((d) => [d.date, d.amount]));
  const labels: string[] = [];
  const values: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    const key = day.toISOString().slice(0, 10);
    labels.push(WEEKDAYS[day.getUTCDay()]);
    values.push((byDate.get(key) ?? 0) / 100);
  }
  return { labels, values };
}

function buildStatusChart(breakdown: Record<string, number>): Array<{ label: string; value: number }> {
  return STATUS_BUCKETS.map((bucket) => ({
    label: bucket.label,
    value: bucket.statuses.reduce((sum, status) => sum + (breakdown[status] ?? 0), 0),
  }));
}

export function analyticsAdapter(
  dto: DashboardAnalyticsResponse,
  now: Date = new Date(),
): DashboardAnalyticsView {
  return {
    scope: dto.scope,
    windowDays: dto.windowDays,
    currency: dto.currency,
    cards: {
      revenue: toMoneyView(dto.cards.revenue),
      totalOrders: dto.cards.totalOrders,
      activeOrders: dto.cards.activeOrders,
      avgOrderValue: toMoneyView(dto.cards.avgOrderValue),
      delivered: dto.cards.delivered,
      cancelled: dto.cards.cancelled,
      restaurantCount: dto.cards.restaurantCount,
      revenueTrendPct: dto.cards.revenueTrendPct,
      ordersTrendPct: dto.cards.ordersTrendPct,
    },
    statusChart: buildStatusChart(dto.statusBreakdown),
    revenueSeries: buildRevenueSeries(dto.revenueByDay, now),
    topRestaurants: dto.topRestaurants.map((r) => ({
      restaurantId: r.restaurantId,
      name: r.name,
      revenue: toMoneyView(r.revenue),
      orders: r.orders,
    })),
  };
}
