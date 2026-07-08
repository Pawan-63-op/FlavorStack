import { toMajorMoney } from "./cart";
import { getFulfillmentStatusInfo, getDeliveryStatusInfo } from "../../orders/statusMap";
import type { Money } from "../format/money";

/**
 * server_2 `GET /me/orders` DTO → app order-history view-model (Phase 15 / G1).
 *
 * Source contract: `server_2/src/application/fulfillment/responses/CustomerOrderResponse.ts`.
 * Each row carries the order↔fulfillment linkage (`orderRequestId` + `fulfillmentId`)
 * so the frontend can resolve and track an order without the client-only
 * localStorage linkage. `total` is integer minor units on the wire (mirrors
 * `adapters/cart.ts#toMajorMoney`).
 */
export interface CustomerOrderResponse {
  fulfillmentId: string;
  orderRequestId: string;
  restaurantId: string;
  fulfillmentStatus: string;
  deliveryStatus: string;
  total: { amount: number; currency: string };
  placedAt: string;
  updatedAt: string;
}

export interface CustomerOrderVM {
  fulfillmentId: string;
  orderRequestId: string;
  restaurantId: string;
  fulfillmentStatus: string;
  fulfillmentStatusLabel: string;
  deliveryStatus: string;
  deliveryStatusLabel: string;
  total: Money;
  placedAt: string;
  updatedAt: string;
}

export function customerOrderAdapter(dto: CustomerOrderResponse): CustomerOrderVM {
  return {
    fulfillmentId: dto.fulfillmentId,
    orderRequestId: dto.orderRequestId,
    restaurantId: dto.restaurantId,
    fulfillmentStatus: dto.fulfillmentStatus,
    fulfillmentStatusLabel: getFulfillmentStatusInfo(dto.fulfillmentStatus).label,
    deliveryStatus: dto.deliveryStatus,
    deliveryStatusLabel: getDeliveryStatusInfo(dto.deliveryStatus).label,
    total: toMajorMoney(dto.total),
    placedAt: dto.placedAt,
    updatedAt: dto.updatedAt,
  };
}
