/**
 * Single source of truth mapping server_2's fulfillment/delivery/order-request
 * status enums to FE label, icon key, color token, and active/terminal
 * predicates. Replaces ad-hoc status switches scattered across order UI.
 *
 * Server enums (canonical): `domain/fulfillment/enums/fulfillment-status.enum.ts`,
 * `domain/fulfillment/enums/delivery-status.enum.ts`,
 * `domain/commerce/enums/order-request-status.enum.ts`.
 */
export type StatusIconKey =
  | "placed"
  | "preparing"
  | "ready"
  | "pickedUp"
  | "onTheWay"
  | "delivered"
  | "cancelled"
  | "failed"
  | "unassigned"
  | "assigned"
  | "enRoute"
  | "atRestaurant"
  | "unknown";

export type StatusColorToken = "neutral" | "info" | "warning" | "success" | "danger";

export interface StatusInfo {
  label: string;
  icon: StatusIconKey;
  color: StatusColorToken;
  /** True for in-progress, non-terminal states. */
  isActive: boolean;
  /** True once the order/delivery can no longer change state. */
  isTerminal: boolean;
}

const UNKNOWN_STATUS_INFO: StatusInfo = {
  label: "Unknown",
  icon: "unknown",
  color: "neutral",
  isActive: false,
  isTerminal: false,
};

const FULFILLMENT_STATUS_MAP: Record<string, StatusInfo> = {
  CREATED: { label: "Order received", icon: "placed", color: "info", isActive: true, isTerminal: false },
  PREPARING: { label: "Preparing", icon: "preparing", color: "info", isActive: true, isTerminal: false },
  READY_FOR_PICKUP: { label: "Ready for pickup", icon: "ready", color: "info", isActive: true, isTerminal: false },
  PICKED_UP: { label: "Picked up", icon: "pickedUp", color: "info", isActive: true, isTerminal: false },
  OUT_FOR_DELIVERY: { label: "Out for delivery", icon: "onTheWay", color: "info", isActive: true, isTerminal: false },
  DELIVERED: { label: "Delivered", icon: "delivered", color: "success", isActive: false, isTerminal: true },
  CANCELLED: { label: "Cancelled", icon: "cancelled", color: "danger", isActive: false, isTerminal: true },
  FAILED: { label: "Failed", icon: "failed", color: "danger", isActive: false, isTerminal: true },
  ASSIGNED: { label: "Rider assigned", icon: "assigned", color: "info", isActive: true, isTerminal: false },
  REASSIGNED: { label: "Rider reassigned", icon: "assigned", color: "info", isActive: true, isTerminal: false },
};

const DELIVERY_STATUS_MAP: Record<string, StatusInfo> = {
  UNASSIGNED: { label: "Awaiting rider", icon: "unassigned", color: "neutral", isActive: true, isTerminal: false },
  ASSIGNED: { label: "Rider assigned", icon: "assigned", color: "info", isActive: true, isTerminal: false },
  EN_ROUTE_TO_RESTAURANT: { label: "Rider heading to restaurant", icon: "enRoute", color: "info", isActive: true, isTerminal: false },
  AT_RESTAURANT: { label: "Rider at restaurant", icon: "atRestaurant", color: "info", isActive: true, isTerminal: false },
  PICKED_UP: { label: "Picked up", icon: "pickedUp", color: "info", isActive: true, isTerminal: false },
  EN_ROUTE_TO_CUSTOMER: { label: "On the way to you", icon: "onTheWay", color: "info", isActive: true, isTerminal: false },
  DELIVERED: { label: "Delivered", icon: "delivered", color: "success", isActive: false, isTerminal: true },
  FAILED: { label: "Delivery failed", icon: "failed", color: "danger", isActive: false, isTerminal: true },
};

const ORDER_REQUEST_STATUS_MAP: Record<string, StatusInfo> = {
  REQUESTED: { label: "Order placed", icon: "placed", color: "info", isActive: true, isTerminal: false },
};

/** Label/icon/color/predicates for a `FULFILLMENT_STATUS` value; safe default for unknowns. */
export function getFulfillmentStatusInfo(status: string): StatusInfo {
  return FULFILLMENT_STATUS_MAP[status] ?? UNKNOWN_STATUS_INFO;
}

/** Label/icon/color/predicates for a `DELIVERY_STATUS` value; safe default for unknowns. */
export function getDeliveryStatusInfo(status: string): StatusInfo {
  return DELIVERY_STATUS_MAP[status] ?? UNKNOWN_STATUS_INFO;
}

/** Label/icon/color/predicates for the pre-fulfillment `ORDER_REQUEST_STATUS` value. */
export function getOrderRequestStatusInfo(status: string): StatusInfo {
  return ORDER_REQUEST_STATUS_MAP[status] ?? UNKNOWN_STATUS_INFO;
}
