import { toMajorMoney, type MoneyResponse } from "./cart";
import { formatMoney, type Money } from "../format/money";
import { formatRelativeTime } from "../format/date";
import { getDeliveryStatusInfo, getFulfillmentStatusInfo } from "../../orders/statusMap";

/**
 * server_2 admin-fulfillment DTOs → app view-models (Phase 11, Batch 11.2).
 *
 * Mapping source: `my-app/integration_phases/Phase_11.md` (frozen server_2
 * `/admin/fulfillments*` contract). `total` is integer minor units on the
 * wire — converted via `adapters/cart.ts#toMajorMoney`, formatted via the
 * shared `format/money.ts`; ages use the shared `format/date.ts`.
 *
 * Derived eligibility flags are a **deliberate simplification** — the server
 * is the source of truth for the nuanced mid-flow cases:
 *  - `isCancellable` mirrors the verified state machine (cancel is only valid
 *    for `CREATED|PREPARING|READY_FOR_PICKUP`).
 *  - `isReassignable` is disabled only on the unambiguous terminal states
 *    (`DELIVERED|CANCELLED|FAILED`); the true "ASSIGNED-stage" rule is not
 *    replicated client-side — anything else the server rejects with its real
 *    error, surfaced in the action dialog.
 */

/** Terminal fulfillment statuses — no further transitions possible. */
export const TERMINAL_FULFILLMENT_STATUSES = ["DELIVERED", "CANCELLED", "FAILED"] as const;

/** Statuses from which a cancel is accepted server-side (verified state machine). */
export const CANCELLABLE_FULFILLMENT_STATUSES = [
  "CREATED",
  "PREPARING",
  "READY_FOR_PICKUP",
] as const;

export interface FulfillmentCancellationResponse {
  cancelledBy: string;
  reason: string;
  at: string;
}

export interface CurrentAssignmentResponse {
  riderId: string;
  status: string;
  attempt: number;
  expiresAt: string;
}

/** A selected option/variant on an order line (e.g. "Extra cheese"). */
export interface FulfillmentLineOptionResponse {
  optionId: string;
  label: string;
}

/** One order line on a fulfillment — what the kitchen has to make (G18). */
export interface FulfillmentLineResponse {
  menuItemId: string;
  name: string;
  quantity: number;
  selectedOptions: FulfillmentLineOptionResponse[];
  lineTotal: MoneyResponse;
}

/** Where the order is going — surfaced to the owner for prep/handoff (G18). */
export interface DeliveryAddressResponse {
  label?: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
}

/** `GET /admin/fulfillments` row — global dashboard item. */
export interface AdminDashboardItemResponse {
  fulfillmentId: string;
  orderRequestId: string;
  customerId: string;
  restaurantId: string;
  status: string;
  deliveryStatus: string;
  riderId: string | null;
  createdAt: string;
  updatedAt: string;
  slaBreached: boolean;
  exceptionFlag: boolean;
  cancellation: FulfillmentCancellationResponse | null;
  failureReason: string | null;
  total: MoneyResponse;
}

/** Reassign/cancel/restaurant-queue response — full fulfillment aggregate. */
export interface FulfillmentAdminResponse {
  fulfillmentId: string;
  orderRequestId: string;
  customerId: string;
  restaurantId: string;
  status: string;
  deliveryStatus: string;
  prepEstimateMinutes?: number;
  total: MoneyResponse;
  currentAssignment: CurrentAssignmentResponse | null;
  cancellation: FulfillmentCancellationResponse | null;
  failureReason: string | null;
  createdAt: string;
  readyAt?: string;
  updatedAt: string;
  /** Order lines + delivery address (G18). Optional for back-compat with older payloads. */
  lines?: FulfillmentLineResponse[];
  deliveryAddress?: DeliveryAddressResponse;
}

/** Derived action-eligibility flags shared by both admin view-models. */
export interface FulfillmentEligibility {
  isCancellable: boolean;
  isReassignable: boolean;
}

export interface AdminDashboardItemView extends FulfillmentEligibility {
  fulfillmentId: string;
  orderRequestId: string;
  customerId: string;
  restaurantId: string;
  status: string;
  statusLabel: string;
  deliveryStatus: string;
  deliveryStatusLabel: string;
  riderId: string | null;
  createdAt: string;
  formattedAge: string;
  updatedAt: string;
  slaBreached: boolean;
  exceptionFlag: boolean;
  cancellation: FulfillmentCancellationResponse | null;
  failureReason: string | null;
  total: Money;
  formattedTotal: string;
}

/** One order line, money pre-formatted for display (G18). */
export interface FulfillmentLineView {
  menuItemId: string;
  name: string;
  quantity: number;
  selectedOptions: FulfillmentLineOptionResponse[];
  lineTotal: Money;
  formattedLineTotal: string;
}

export interface FulfillmentAdminView extends FulfillmentEligibility {
  fulfillmentId: string;
  orderRequestId: string;
  customerId: string;
  restaurantId: string;
  status: string;
  statusLabel: string;
  deliveryStatus: string;
  deliveryStatusLabel: string;
  prepEstimateMinutes?: number;
  total: Money;
  formattedTotal: string;
  currentAssignment: CurrentAssignmentResponse | null;
  cancellation: FulfillmentCancellationResponse | null;
  failureReason: string | null;
  createdAt: string;
  readyAt?: string;
  updatedAt: string;
  /** Order lines — what to prepare (G18); always an array (empty if omitted on the wire). */
  lines: FulfillmentLineView[];
  /** Raw delivery address (G18); undefined when the payload omits it. */
  deliveryAddress?: DeliveryAddressResponse;
  /** One-line, render-ready delivery address (G18); undefined when no address. */
  formattedAddress?: string;
}

/** "123 MG Road, Bengaluru, KA 560001" — render-ready single line for the queue card. */
export function formatDeliveryAddress(address: DeliveryAddressResponse): string {
  return `${address.street}, ${address.city}, ${address.state} ${address.pinCode}`;
}

/** Map a wire order line → view-model with pre-formatted money. */
export function fulfillmentLineAdapter(line: FulfillmentLineResponse): FulfillmentLineView {
  const lineTotal = toMajorMoney(line.lineTotal);
  return {
    menuItemId: line.menuItemId,
    name: line.name,
    quantity: line.quantity,
    selectedOptions: line.selectedOptions ?? [],
    lineTotal,
    formattedLineTotal: formatMoney(lineTotal),
  };
}

/** Pure derivation of the action-eligibility flags from a fulfillment status. */
export function deriveFulfillmentEligibility(status: string): FulfillmentEligibility {
  return {
    isCancellable: (CANCELLABLE_FULFILLMENT_STATUSES as readonly string[]).includes(status),
    isReassignable: !(TERMINAL_FULFILLMENT_STATUSES as readonly string[]).includes(status),
  };
}

/** `GET /admin/fulfillments` item DTO → dashboard view-model. */
export function adminDashboardItemAdapter(dto: AdminDashboardItemResponse): AdminDashboardItemView {
  const total = toMajorMoney(dto.total);
  return {
    fulfillmentId: dto.fulfillmentId,
    orderRequestId: dto.orderRequestId,
    customerId: dto.customerId,
    restaurantId: dto.restaurantId,
    status: dto.status,
    statusLabel: getFulfillmentStatusInfo(dto.status).label,
    deliveryStatus: dto.deliveryStatus,
    deliveryStatusLabel: getDeliveryStatusInfo(dto.deliveryStatus).label,
    riderId: dto.riderId,
    createdAt: dto.createdAt,
    formattedAge: formatRelativeTime(dto.createdAt),
    updatedAt: dto.updatedAt,
    slaBreached: dto.slaBreached,
    exceptionFlag: dto.exceptionFlag,
    cancellation: dto.cancellation,
    failureReason: dto.failureReason,
    total,
    formattedTotal: formatMoney(total),
    ...deriveFulfillmentEligibility(dto.status),
  };
}

/** Reassign/cancel/restaurant-queue DTO → full admin view-model. */
export function fulfillmentAdminAdapter(dto: FulfillmentAdminResponse): FulfillmentAdminView {
  const total = toMajorMoney(dto.total);
  return {
    fulfillmentId: dto.fulfillmentId,
    orderRequestId: dto.orderRequestId,
    customerId: dto.customerId,
    restaurantId: dto.restaurantId,
    status: dto.status,
    statusLabel: getFulfillmentStatusInfo(dto.status).label,
    deliveryStatus: dto.deliveryStatus,
    deliveryStatusLabel: getDeliveryStatusInfo(dto.deliveryStatus).label,
    ...(dto.prepEstimateMinutes !== undefined
      ? { prepEstimateMinutes: dto.prepEstimateMinutes }
      : {}),
    total,
    formattedTotal: formatMoney(total),
    currentAssignment: dto.currentAssignment,
    cancellation: dto.cancellation,
    failureReason: dto.failureReason,
    createdAt: dto.createdAt,
    ...(dto.readyAt !== undefined ? { readyAt: dto.readyAt } : {}),
    updatedAt: dto.updatedAt,
    lines: (dto.lines ?? []).map(fulfillmentLineAdapter),
    ...(dto.deliveryAddress
      ? {
          deliveryAddress: dto.deliveryAddress,
          formattedAddress: formatDeliveryAddress(dto.deliveryAddress),
        }
      : {}),
    ...deriveFulfillmentEligibility(dto.status),
  };
}
