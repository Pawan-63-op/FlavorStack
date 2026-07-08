import { CustomerOrderSummaryView } from '../../../domain/fulfillment/repositories/IFulfillmentProjectionRepository';

export interface CustomerOrderResponse {
  fulfillmentId: string;
  orderRequestId: string;
  restaurantId: string;
  fulfillmentStatus: string;
  deliveryStatus: string;
  total: { amount: number; currency: string };
  placedAt: string; // ISO string
  updatedAt: string; // ISO string
}

function toIso(value: Date): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

export function toCustomerOrderResponse(view: CustomerOrderSummaryView): CustomerOrderResponse {
  return {
    fulfillmentId: view.fulfillmentId,
    orderRequestId: view.orderRequestId,
    restaurantId: view.restaurantId,
    fulfillmentStatus: view.fulfillmentStatus,
    deliveryStatus: view.deliveryStatus,
    total: view.total,
    placedAt: toIso(view.placedAt),
    updatedAt: toIso(view.updatedAt),
  };
}
