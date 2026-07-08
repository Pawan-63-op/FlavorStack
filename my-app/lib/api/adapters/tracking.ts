import type { DeliveryAddressResponse } from "./checkout";
import { toMajorMoney } from "./cart";
import { formatMoney, type Money } from "../format/money";
import { getDeliveryStatusInfo, getFulfillmentStatusInfo } from "../../orders/statusMap";

/**
 * server_2 fulfillment-tracking DTO → app tracking view-model.
 *
 * Mapping source: `my-app/integration_phases/Phase_7.md` (frozen server_2
 * `GET /fulfillments/:id/tracking` contract,
 * `server_2/src/application/fulfillment/responses/TrackingResponse.ts`).
 *
 * `total` is integer minor units on the wire; conversion mirrors
 * `adapters/cart.ts#toMajorMoney`. `deliveryAddress` reuses the checkout
 * adapter's `DeliveryAddressResponse` shape verbatim (already view-model
 * compatible, no money to convert).
 */
export interface TrackingTimelineEntryResponse {
  status: string;
  at: string;
  note?: string;
}

export interface TrackingResponse {
  fulfillmentId: string;
  orderRequestId: string;
  currentStatus: string;
  deliveryStatus: string;
  riderId: string | null;
  timeline: TrackingTimelineEntryResponse[];
  deliveryAddress: DeliveryAddressResponse;
  total: { amount: number; currency: string };
  cancellation: { cancelledBy: string; reason: string; at: string } | null;
  failureReason: string | null;
  updatedAt: string;
}

export interface TrackingTimelineEntryVM {
  status: string;
  statusLabel: string;
  at: string;
  note?: string;
}

export interface CancellationVM {
  cancelledBy: string;
  reason: string;
  at: string;
}

export interface TrackingView {
  fulfillmentId: string;
  orderRequestId: string;
  currentStatus: string;
  currentStatusLabel: string;
  deliveryStatus: string;
  deliveryStatusLabel: string;
  riderId: string | null;
  timeline: TrackingTimelineEntryVM[];
  deliveryAddress: DeliveryAddressResponse;
  total: Money;
  formattedTotal: string;
  cancellation: CancellationVM | null;
  failureReason: string | null;
  updatedAt: string;
  /** Derived from `currentStatus` via `statusMap`; true once no further updates will arrive. */
  isTerminal: boolean;
}

function timelineEntryAdapter(entry: TrackingTimelineEntryResponse): TrackingTimelineEntryVM {
  return {
    status: entry.status,
    statusLabel: getFulfillmentStatusInfo(entry.status).label,
    at: entry.at,
    ...(entry.note !== undefined ? { note: entry.note } : {}),
  };
}

export function trackingAdapter(dto: TrackingResponse): TrackingView {
  const total = toMajorMoney(dto.total);
  const currentInfo = getFulfillmentStatusInfo(dto.currentStatus);
  return {
    fulfillmentId: dto.fulfillmentId,
    orderRequestId: dto.orderRequestId,
    currentStatus: dto.currentStatus,
    currentStatusLabel: currentInfo.label,
    deliveryStatus: dto.deliveryStatus,
    deliveryStatusLabel: getDeliveryStatusInfo(dto.deliveryStatus).label,
    riderId: dto.riderId,
    timeline: dto.timeline.map(timelineEntryAdapter),
    deliveryAddress: dto.deliveryAddress,
    total,
    formattedTotal: formatMoney(total),
    cancellation: dto.cancellation,
    failureReason: dto.failureReason,
    updatedAt: dto.updatedAt,
    isTerminal: currentInfo.isTerminal,
  };
}
