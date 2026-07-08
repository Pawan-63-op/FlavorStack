import { analyticsAdapter, type DashboardAnalyticsResponse, type DashboardAnalyticsView } from "../adapters/analytics";
import { client } from "../client/http";

/**
 * Owner/Admin Overview analytics service (Phase 15 / G13) — thin transport over
 * the composed API client. Maps the frozen server_2 contract
 * (`GET /owner/analytics`, `GET /admin/analytics`, fulfillment context) through
 * `analyticsAdapter`. `days` is the trailing window (server clamps 1–365,
 * defaults to 30 when omitted).
 */
class AnalyticsService {
  private readonly http = client;

  /** GET /owner/analytics — scoped to the caller's restaurants. */
  async getOwner(days?: number): Promise<DashboardAnalyticsView> {
    const dto = await this.http.get<DashboardAnalyticsResponse>(`/owner/analytics${daysQuery(days)}`);
    return analyticsAdapter(dto);
  }

  /** GET /admin/analytics — platform-wide (admin only). */
  async getPlatform(days?: number): Promise<DashboardAnalyticsView> {
    const dto = await this.http.get<DashboardAnalyticsResponse>(`/admin/analytics${daysQuery(days)}`);
    return analyticsAdapter(dto);
  }
}

function daysQuery(days?: number): string {
  return days === undefined ? "" : `?days=${days}`;
}

export const analyticsService = new AnalyticsService();
