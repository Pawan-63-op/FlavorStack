import {
  fulfillmentAdminAdapter,
  type FulfillmentAdminResponse,
  type FulfillmentAdminView,
} from "../adapters/fulfillmentAdmin";
import {
  riderQueueItemAdapter,
  riderDeliveryHistoryAdapter,
  type DriverAvailabilityResponse,
  type DriverAvailabilityView,
  type RiderQueueItemResponse,
  type RiderQueueItemView,
  type RiderDeliveryHistoryResponse,
  type RiderDeliveryHistoryView,
} from "../adapters/driver";
import { client } from "../client/http";

/**
 * Driver service (Phase 14.4) — the rider-side surface that previously existed
 * only as curl/E2E: presence toggle, the active delivery queue, and the
 * accept→deliver lifecycle actions. All endpoints already ship server-side and
 * are guarded by `requireRole(DRIVER)` (the UI route guard is UX-only).
 *
 * The lifecycle actions return the shared `FulfillmentResponse`
 * (= `FulfillmentAdminResponse`), so they reuse `fulfillmentAdminAdapter`. The
 * location ping is a fire-and-forget 204.
 */
class DriverService {
  /** Composed transport (single-flight 401→refresh applied). */
  private readonly http = client;

  /** PATCH /users/me/availability {available} — go online (true) / offline (false). */
  async setAvailability(available: boolean): Promise<DriverAvailabilityView> {
    return this.http.patch<DriverAvailabilityResponse>("/users/me/availability", {
      body: { available },
    });
  }

  /** GET /riders/me/queue — offered + accepted deliveries for the signed-in driver. */
  async getQueue(): Promise<RiderQueueItemView[]> {
    const dtos = await this.http.get<RiderQueueItemResponse[]>("/riders/me/queue");
    return dtos.map(riderQueueItemAdapter);
  }

  /** GET /riders/me/deliveries — completed-delivery history + earnings (G19). */
  async getDeliveryHistory(): Promise<RiderDeliveryHistoryView> {
    const dto = await this.http.get<RiderDeliveryHistoryResponse>("/riders/me/deliveries");
    return riderDeliveryHistoryAdapter(dto);
  }

  /** POST /fulfillments/:id/accept — accept the active offer. */
  async accept(id: string): Promise<FulfillmentAdminView> {
    const dto = await this.http.post<FulfillmentAdminResponse>(`/fulfillments/${id}/accept`, {
      body: {},
    });
    return fulfillmentAdminAdapter(dto);
  }

  /** POST /fulfillments/:id/reject — decline the active offer; `reason` optional (1–500 chars). */
  async reject(id: string, reason?: string): Promise<FulfillmentAdminView> {
    const dto = await this.http.post<FulfillmentAdminResponse>(`/fulfillments/${id}/reject`, {
      body: reason ? { reason } : {},
    });
    return fulfillmentAdminAdapter(dto);
  }

  /** POST /fulfillments/:id/pickup — collect the food (READY_FOR_PICKUP → PICKED_UP). */
  async pickup(id: string): Promise<FulfillmentAdminView> {
    const dto = await this.http.post<FulfillmentAdminResponse>(`/fulfillments/${id}/pickup`, {
      body: {},
    });
    return fulfillmentAdminAdapter(dto);
  }

  /** POST /fulfillments/:id/out-for-delivery — depart for the customer (→ OUT_FOR_DELIVERY). */
  async outForDelivery(id: string): Promise<FulfillmentAdminView> {
    const dto = await this.http.post<FulfillmentAdminResponse>(
      `/fulfillments/${id}/out-for-delivery`,
      { body: {} },
    );
    return fulfillmentAdminAdapter(dto);
  }

  /** POST /fulfillments/:id/deliver — hand over to the customer (→ DELIVERED); `proof` optional. */
  async deliver(id: string, proof?: string): Promise<FulfillmentAdminView> {
    const dto = await this.http.post<FulfillmentAdminResponse>(`/fulfillments/${id}/deliver`, {
      body: proof ? { proof } : {},
    });
    return fulfillmentAdminAdapter(dto);
  }

  /** POST /fulfillments/:id/fail — report an unrecoverable failure with a required reason enum. */
  async fail(id: string, failureReason: string): Promise<FulfillmentAdminView> {
    const dto = await this.http.post<FulfillmentAdminResponse>(`/fulfillments/${id}/fail`, {
      body: { failureReason },
    });
    return fulfillmentAdminAdapter(dto);
  }

  /** POST /fulfillments/:id/location {lat,lng} — GPS ping (204, no body returned). */
  async recordLocation(id: string, lat: number, lng: number): Promise<void> {
    await this.http.post<void>(`/fulfillments/${id}/location`, { body: { lat, lng } });
  }
}

export const driverService = new DriverService();
