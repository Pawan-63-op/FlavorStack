import {
  adminDashboardItemAdapter,
  fulfillmentAdminAdapter,
  type AdminDashboardItemResponse,
  type AdminDashboardItemView,
  type FulfillmentAdminResponse,
  type FulfillmentAdminView,
} from "../adapters/fulfillmentAdmin";
import { client } from "../client/http";

/**
 * Fulfillment admin service (Phase 11, Batch 11.2) — ADMIN-only global
 * fulfillment dashboard + reassign/cancel actions over the composed API
 * client. Mapping source: `my-app/integration_phases/Phase_11.md` (frozen
 * server_2 `/admin/fulfillments*` contract).
 *
 * The list endpoint returns a **bare `AdminDashboardItemResponse[]`** (no
 * wrapper, no total) with **offset** pagination, so `hasMore` is derived from
 * the page length — same length-derived limitation accepted in Phase 9.
 */

export interface ListAdminFulfillmentsParams {
  status?: string;
  slaBreached?: boolean;
  restaurantId?: string;
  limit?: number;
  offset?: number;
}

export interface AdminFulfillmentsPage {
  items: AdminDashboardItemView[];
  hasMore: boolean;
}

const DEFAULT_LIMIT = 20;

/**
 * Builds the `GET /admin/fulfillments` query string. `slaBreached` is sent as
 * the server's exact string enum (`'true'`/`'false'`), not a JS boolean;
 * `status`/`restaurantId` are omitted when unset.
 */
function buildListQuery(
  params: ListAdminFulfillmentsParams,
  limit: number,
  offset: number,
): string {
  const search = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (params.status) search.set("status", params.status);
  if (params.slaBreached !== undefined) search.set("slaBreached", params.slaBreached ? "true" : "false");
  if (params.restaurantId) search.set("restaurantId", params.restaurantId);
  return `?${search.toString()}`;
}

class FulfillmentAdminService {
  /** Composed transport (single-flight 401→refresh applied). */
  private readonly http = client;

  /** GET /admin/fulfillments?status&slaBreached&restaurantId&limit&offset → adminDashboardItemAdapter per item; length-derived `hasMore`. */
  async listAdminFulfillments(
    params: ListAdminFulfillmentsParams = {},
  ): Promise<AdminFulfillmentsPage> {
    const { limit = DEFAULT_LIMIT, offset = 0 } = params;
    const dtos = await this.http.get<AdminDashboardItemResponse[]>(
      `/admin/fulfillments${buildListQuery(params, limit, offset)}`,
    );
    const items = dtos.map(adminDashboardItemAdapter);
    return { items, hasMore: items.length === limit };
  }

  /** POST /admin/fulfillments/:id/reassign; omits `riderId` when blank (server auto-picks the next available rider). */
  async reassignFulfillment(id: string, riderId?: string): Promise<FulfillmentAdminView> {
    const dto = await this.http.post<FulfillmentAdminResponse>(
      `/admin/fulfillments/${id}/reassign`,
      { body: riderId ? { riderId } : {} },
    );
    return fulfillmentAdminAdapter(dto);
  }

  /** POST /admin/fulfillments/:id/cancel with the required reason (1–500 chars) → fulfillmentAdminAdapter. */
  async cancelFulfillment(id: string, reason: string): Promise<FulfillmentAdminView> {
    const dto = await this.http.post<FulfillmentAdminResponse>(
      `/admin/fulfillments/${id}/cancel`,
      { body: { reason } },
    );
    return fulfillmentAdminAdapter(dto);
  }

  /**
   * GET /restaurants/:restaurantId/fulfillments?status — read-only restaurant
   * prep queue (Batch 11.3). Bare `FulfillmentResponse[]`, no pagination per
   * the verified `restaurantFulfillmentsQuery` validator (`status` only). Auth
   * is `authenticate`-only server-side (no ownership check — see Phase_11.md
   * gap note); the Queue UI restricts the picker to owned restaurants as a UX
   * mitigation, not a security control.
   */
  async listRestaurantFulfillments(
    restaurantId: string,
    status?: string,
  ): Promise<FulfillmentAdminView[]> {
    const query = status ? `?${new URLSearchParams({ status }).toString()}` : "";
    const dtos = await this.http.get<FulfillmentAdminResponse[]>(
      `/restaurants/${restaurantId}/fulfillments${query}`,
    );
    return dtos.map(fulfillmentAdminAdapter);
  }
}

export const fulfillmentAdminService = new FulfillmentAdminService();
