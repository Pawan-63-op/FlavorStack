import {
  fulfillmentAdminAdapter,
  type FulfillmentAdminResponse,
  type FulfillmentAdminView,
} from "../adapters/fulfillmentAdmin";
import { client } from "../client/http";

/**
 * Fulfillment **owner** service (Phase 14.2) — restaurant prep-progress actions
 * the owning restaurant performs on its own queue: Mark Preparing and Mark
 * Ready. Distinct from the ADMIN-only global `fulfillmentAdminService`
 * (reassign/cancel); these POSTs are authorised server-side by restaurant
 * ownership (the Phase 13 B.5 owner-auth fix), not the ADMIN role.
 *
 * Both endpoints return the full fulfillment aggregate
 * (`toFulfillmentResponse` → `FulfillmentAdminResponse`), so the responses are
 * mapped with the shared `fulfillmentAdminAdapter`.
 */
class FulfillmentOwnerService {
  /** Composed transport (single-flight 401→refresh applied). */
  private readonly http = client;

  /** POST /fulfillments/:id/preparing — CREATED→PREPARING; sends `prepEstimateMinutes` only when provided. */
  async markPreparing(id: string, prepEstimateMinutes?: number): Promise<FulfillmentAdminView> {
    const dto = await this.http.post<FulfillmentAdminResponse>(
      `/fulfillments/${id}/preparing`,
      { body: prepEstimateMinutes !== undefined ? { prepEstimateMinutes } : {} },
    );
    return fulfillmentAdminAdapter(dto);
  }

  /** POST /fulfillments/:id/ready — PREPARING→READY_FOR_PICKUP (no body). */
  async markReady(id: string): Promise<FulfillmentAdminView> {
    const dto = await this.http.post<FulfillmentAdminResponse>(
      `/fulfillments/${id}/ready`,
      { body: {} },
    );
    return fulfillmentAdminAdapter(dto);
  }
}

export const fulfillmentOwnerService = new FulfillmentOwnerService();
