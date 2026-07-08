import { AnalyticsScope } from '../dtos/GetDashboardAnalyticsDto';

export const DEFAULT_ANALYTICS_CURRENCY = 'INR';

export interface AnalyticsMoney {
  amount: number;
  currency: string;
}

export interface AnalyticsTopRestaurantResponse {
  restaurantId: string;
  name: string;
  revenue: AnalyticsMoney;
  orders: number;
}

export interface AnalyticsDayRevenueResponse {
  /** `YYYY-MM-DD` (UTC). */
  date: string;
  amount: number;
}

export interface DashboardAnalyticsCards {
  revenue: AnalyticsMoney;
  totalOrders: number;
  activeOrders: number;
  avgOrderValue: AnalyticsMoney;
  delivered: number;
  cancelled: number;
  restaurantCount: number;
  /** Percent change vs the previous window; `null` when the previous window had zero activity. */
  revenueTrendPct: number | null;
  ordersTrendPct: number | null;
}

export interface DashboardAnalyticsResponse {
  scope: AnalyticsScope;
  windowDays: number;
  currency: string;
  cards: DashboardAnalyticsCards;
  /** Order count per fulfillment status within the window (present statuses only). */
  statusBreakdown: Record<string, number>;
  revenueByDay: AnalyticsDayRevenueResponse[];
  topRestaurants: AnalyticsTopRestaurantResponse[];
}
