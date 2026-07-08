import {
  customerOrderAdapter,
  type CustomerOrderResponse,
  type CustomerOrderVM,
} from "../adapters/orders";
import { client } from "../client/http";

/**
 * Orders service — server_2 `GET /api/v1/me/orders` (auth, customer-scoped).
 * Returns the caller's orders with their resolved `fulfillmentId` so the FE can
 * track them without the client-only localStorage linkage (Phase 15 / G1).
 * Mirrors `services/tracking.ts`: one method per endpoint, routed through its adapter.
 */
class OrdersService {
  private readonly http = client;

  /** GET /me/orders → customerOrderAdapter per row. */
  async listMyOrders(): Promise<CustomerOrderVM[]> {
    const dtos = await this.http.get<CustomerOrderResponse[]>("/me/orders");
    return dtos.map(customerOrderAdapter);
  }
}

export const ordersService = new OrdersService();
