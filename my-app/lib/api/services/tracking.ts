import { trackingAdapter, type TrackingResponse, type TrackingView } from "../adapters/tracking";
import { client } from "../client/http";

/**
 * Tracking service — server_2 `/api/v1/fulfillments/:id/tracking` (auth,
 * ownership-enforced). Mirrors `services/cart.ts` / `services/checkout.ts`:
 * one method per endpoint, routed through its adapter.
 */
class TrackingService {
  private readonly http = client;

  /** GET /fulfillments/:id/tracking → trackingAdapter. */
  async getTracking(fulfillmentId: string): Promise<TrackingView> {
    const dto = await this.http.get<TrackingResponse>(`/fulfillments/${fulfillmentId}/tracking`);
    return trackingAdapter(dto);
  }

  /**
   * POST /fulfillments/:id/cancel (Phase 15 / G7) — customer cancels their own
   * pre-pickup order with a required reason (1–500 chars, `cancelSchema`). The
   * server resolves the actor as CUSTOMER from the authenticated role and the
   * aggregate enforces ownership + the cancellation window; we don't need the
   * returned fulfillment here (callers refetch tracking), so this resolves void.
   */
  async cancelOrder(fulfillmentId: string, reason: string): Promise<void> {
    await this.http.post(`/fulfillments/${fulfillmentId}/cancel`, { body: { reason } });
  }
}

export const trackingService = new TrackingService();
