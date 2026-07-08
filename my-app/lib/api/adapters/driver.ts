import { toMajorMoney, type MoneyResponse } from "./cart";
import { formatMoney, type Money } from "../format/money";
import { formatRelativeTime, formatDate } from "../format/date";
import { getFulfillmentStatusInfo } from "../../orders/statusMap";

/**
 * server_2 rider/driver DTOs → app view-models (Phase 14.4 — driver operational
 * UI). The driver action endpoints (`accept/reject/pickup/out-for-delivery/
 * deliver/fail`) all return the shared `FulfillmentResponse`
 * (= `FulfillmentAdminResponse`), so those responses reuse the existing
 * `fulfillmentAdminAdapter`. Only the rider-queue projection
 * (`GET /riders/me/queue`) and the availability response need driver-local
 * shapes, defined here.
 *
 * Mapping source: server_2 `application/fulfillment/responses/RiderQueueResponse.ts`
 * and `application/identity/use-cases/SetDriverAvailability.ts` (frozen contracts).
 */

/** `GET /riders/me/queue` delivery address (snapshot, already in major-friendly fields). */
export interface RiderQueueAddressResponse {
  label?: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
  coordinates: { lat: number; lng: number };
}

/** `GET /riders/me/queue` item — one offered or accepted delivery for the rider. */
export interface RiderQueueItemResponse {
  fulfillmentId: string;
  assignmentStatus: string;
  attempt: number;
  expiresAt: string | null;
  restaurantId: string;
  deliveryAddress: RiderQueueAddressResponse;
  total: MoneyResponse;
  fulfillmentStatus: string;
  offeredAt: string;
  updatedAt: string;
}

export interface RiderQueueItemView {
  fulfillmentId: string;
  assignmentStatus: string;
  attempt: number;
  expiresAt: string | null;
  restaurantId: string;
  deliveryAddress: RiderQueueAddressResponse;
  /** Single-line, human-readable delivery address for the card. */
  formattedAddress: string;
  total: Money;
  formattedTotal: string;
  fulfillmentStatus: string;
  fulfillmentStatusLabel: string;
  offeredAt: string;
  formattedOfferedAge: string;
  updatedAt: string;
  /** Driver actions available right now, derived from the state machine below. */
  actions: DriverDeliveryAction[];
}

/** `PATCH /users/me/availability` (and the verify-driver) presence response. */
export interface DriverAvailabilityResponse {
  driverStatus: string;
  isAvailable: boolean;
  isOnline: boolean;
}

export type DriverAvailabilityView = DriverAvailabilityResponse;

/**
 * The mutually-exclusive driver actions, named to match the server routes
 * (`POST /fulfillments/:id/<action>`). `accept`/`reject` resolve the active
 * offer; the rest advance an accepted delivery through the verified state
 * machine.
 */
export type DriverDeliveryAction =
  | "accept"
  | "reject"
  | "pickup"
  | "out-for-delivery"
  | "deliver"
  | "fail";

/**
 * Which driver actions a queue item currently allows, mirroring the verified
 * server state machine:
 *  - an OFFERED assignment → accept / reject the offer;
 *  - an ACCEPTED assignment advances by fulfillment status:
 *    READY_FOR_PICKUP → pickup, PICKED_UP → out-for-delivery,
 *    OUT_FOR_DELIVERY → deliver / fail.
 * Anything else (expired/rejected offer, terminal fulfillment) offers nothing.
 * Pure so it is unit-testable without rendering — the server remains the
 * source of truth and rejects an out-of-order action with its real error.
 */
export function driverActionsForItem(item: {
  assignmentStatus: string;
  fulfillmentStatus: string;
}): DriverDeliveryAction[] {
  if (item.assignmentStatus === "OFFERED") return ["accept", "reject"];
  if (item.assignmentStatus !== "ACCEPTED") return [];
  switch (item.fulfillmentStatus) {
    case "READY_FOR_PICKUP":
      return ["pickup"];
    case "PICKED_UP":
      return ["out-for-delivery"];
    case "OUT_FOR_DELIVERY":
      return ["deliver", "fail"];
    default:
      return [];
  }
}

/** One-line delivery address from the queue snapshot, skipping blank parts. */
export function formatQueueAddress(address: RiderQueueAddressResponse): string {
  return [address.street, address.city, address.state, address.pinCode]
    .filter((part) => part && part.trim().length > 0)
    .join(", ");
}

/**
 * Delivery-failure reasons offered in the driver UI, mirroring the server
 * `FAILURE_REASON` enum (`domain/fulfillment/enums/failure-reason.enum.ts`).
 * `value` is the wire enum; `label` is the human-readable option.
 */
export const DRIVER_FAILURE_REASONS = [
  { value: "CUSTOMER_UNAVAILABLE", label: "Customer unavailable" },
  { value: "ADDRESS_NOT_FOUND", label: "Address not found" },
  { value: "RIDER_CANCELLED", label: "Rider cancelled" },
  { value: "RESTAURANT_CLOSED", label: "Restaurant closed" },
  { value: "DELIVERY_TIMEOUT", label: "Delivery timeout" },
  { value: "OTHER", label: "Other" },
] as const;

/**
 * `GET /riders/me/deliveries` (Phase 15 / G19) — the rider's completed-delivery
 * history + earnings. `total`/`earning` are integer minor units on the wire.
 *
 * Mapping source: server_2
 * `application/fulfillment/responses/RiderDeliveryHistoryResponse.ts`.
 */
export interface RiderDeliveryHistoryItemResponse {
  fulfillmentId: string;
  restaurantId: string;
  status: string;
  total: MoneyResponse;
  earning: MoneyResponse;
  deliveredAt: string;
}

export interface RiderDeliveryHistoryResponse {
  deliveries: RiderDeliveryHistoryItemResponse[];
  summary: {
    totalDeliveries: number;
    totalEarnings: MoneyResponse;
  };
}

export interface RiderDeliveryHistoryItemView {
  fulfillmentId: string;
  restaurantId: string;
  status: string;
  statusLabel: string;
  total: Money;
  formattedTotal: string;
  earning: Money;
  formattedEarning: string;
  deliveredAt: string;
  formattedDeliveredAt: string;
}

export interface RiderDeliveryHistoryView {
  deliveries: RiderDeliveryHistoryItemView[];
  totalDeliveries: number;
  totalEarnings: Money;
  formattedTotalEarnings: string;
}

/** `GET /riders/me/deliveries` DTO → driver history view-model. */
export function riderDeliveryHistoryAdapter(
  dto: RiderDeliveryHistoryResponse,
): RiderDeliveryHistoryView {
  const totalEarnings = toMajorMoney(dto.summary.totalEarnings);
  return {
    deliveries: dto.deliveries.map((d) => {
      const total = toMajorMoney(d.total);
      const earning = toMajorMoney(d.earning);
      return {
        fulfillmentId: d.fulfillmentId,
        restaurantId: d.restaurantId,
        status: d.status,
        statusLabel: getFulfillmentStatusInfo(d.status).label,
        total,
        formattedTotal: formatMoney(total),
        earning,
        formattedEarning: formatMoney(earning),
        deliveredAt: d.deliveredAt,
        formattedDeliveredAt: formatDate(d.deliveredAt),
      };
    }),
    totalDeliveries: dto.summary.totalDeliveries,
    totalEarnings,
    formattedTotalEarnings: formatMoney(totalEarnings),
  };
}

/** `GET /riders/me/queue` item DTO → driver queue view-model. */
export function riderQueueItemAdapter(dto: RiderQueueItemResponse): RiderQueueItemView {
  const total = toMajorMoney(dto.total);
  return {
    fulfillmentId: dto.fulfillmentId,
    assignmentStatus: dto.assignmentStatus,
    attempt: dto.attempt,
    expiresAt: dto.expiresAt,
    restaurantId: dto.restaurantId,
    deliveryAddress: dto.deliveryAddress,
    formattedAddress: formatQueueAddress(dto.deliveryAddress),
    total,
    formattedTotal: formatMoney(total),
    fulfillmentStatus: dto.fulfillmentStatus,
    fulfillmentStatusLabel: getFulfillmentStatusInfo(dto.fulfillmentStatus).label,
    offeredAt: dto.offeredAt,
    formattedOfferedAge: formatRelativeTime(dto.offeredAt),
    updatedAt: dto.updatedAt,
    actions: driverActionsForItem(dto),
  };
}
