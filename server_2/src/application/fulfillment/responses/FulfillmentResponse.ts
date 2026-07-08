import { Fulfillment } from '../../../domain/fulfillment/entities/Fulfillment';

export interface RiderAssignmentSummary {
  riderId: string;
  status: string;
  attempt: number;
  expiresAt: string;
}

export interface CancellationSummary {
  cancelledBy: string;
  reason: string;
  at: string;
}

/** A selected option/variant on an order line (e.g. "Extra spicy"). */
export interface FulfillmentLineOptionSummary {
  optionId: string;
  label: string;
}

/** One order line — what the kitchen has to make (G18). */
export interface FulfillmentLineSummary {
  menuItemId: string;
  name: string;
  quantity: number;
  selectedOptions: FulfillmentLineOptionSummary[];
  lineTotal: { amount: number; currency: string };
}

/** Where the order is going — surfaced to the owner for prep/handoff (G18). */
export interface DeliveryAddressSummary {
  label?: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
}

export interface FulfillmentResponse {
  fulfillmentId: string;
  orderRequestId: string;
  customerId: string;
  restaurantId: string;
  status: string;
  deliveryStatus: string;
  prepEstimateMinutes?: number;
  total: { amount: number; currency: string };
  currentAssignment: RiderAssignmentSummary | null;
  cancellation: CancellationSummary | null;
  failureReason: string | null;
  createdAt: string;
  readyAt?: string;
  updatedAt: string;
  lines: FulfillmentLineSummary[];
  deliveryAddress: DeliveryAddressSummary;
}

export function toFulfillmentResponse(fulfillment: Fulfillment): FulfillmentResponse {
  return {
    fulfillmentId: fulfillment.id.toString(),
    orderRequestId: fulfillment.orderRequestId,
    customerId: fulfillment.customerId,
    restaurantId: fulfillment.restaurantId,
    status: fulfillment.fulfillmentStatus.value,
    deliveryStatus: fulfillment.deliveryStatus.value,
    prepEstimateMinutes: fulfillment.prepEstimateMinutes,
    total: { amount: fulfillment.pricingTotal.amount, currency: fulfillment.pricingTotal.currency },
    currentAssignment: fulfillment.currentAssignment
      ? {
          riderId: fulfillment.currentAssignment.riderId,
          status: fulfillment.currentAssignment.status.value,
          attempt: fulfillment.currentAssignment.attempt,
          expiresAt: fulfillment.currentAssignment.expiresAt.toISOString(),
        }
      : null,
    cancellation: fulfillment.cancellation
      ? {
          cancelledBy: fulfillment.cancellation.cancelledBy,
          reason: fulfillment.cancellation.reason,
          at: fulfillment.cancellation.at.toISOString(),
        }
      : null,
    failureReason: fulfillment.failureReason,
    createdAt: fulfillment.createdAt.toISOString(),
    readyAt: fulfillment.readyAt?.toISOString(),
    updatedAt: fulfillment.updatedAt.toISOString(),
    lines: fulfillment.lines.map((line) => ({
      menuItemId: line.menuItemId,
      name: line.name,
      quantity: line.quantity,
      selectedOptions: line.selectedOptions.map((o) => ({ optionId: o.optionId, label: o.label })),
      lineTotal: { amount: line.lineTotal.amount, currency: line.lineTotal.currency },
    })),
    deliveryAddress: {
      ...(fulfillment.deliveryAddress.label !== undefined
        ? { label: fulfillment.deliveryAddress.label }
        : {}),
      street: fulfillment.deliveryAddress.street,
      city: fulfillment.deliveryAddress.city,
      state: fulfillment.deliveryAddress.state,
      pinCode: fulfillment.deliveryAddress.pinCode,
    },
  };
}
