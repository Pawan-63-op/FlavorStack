// Read shape returned by Fulfillment use cases (fulfillment_module.md §6.4).
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
  };
}
