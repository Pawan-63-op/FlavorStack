import { AdminDashboardView } from '../../../domain/fulfillment/repositories/IFulfillmentQueryRepository';

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
  cancellation: { cancelledBy: string; reason: string; at: string } | null;
  failureReason: string | null;
  total: { amount: number; currency: string };
}

export function toAdminDashboardItemResponse(view: AdminDashboardView): AdminDashboardItemResponse {
  return {
    fulfillmentId: view.fulfillmentId,
    orderRequestId: view.orderRequestId,
    customerId: view.customerId,
    restaurantId: view.restaurantId,
    status: view.status,
    deliveryStatus: view.deliveryStatus,
    riderId: view.riderId,
    createdAt: view.createdAt instanceof Date ? view.createdAt.toISOString() : String(view.createdAt),
    updatedAt: view.updatedAt instanceof Date ? view.updatedAt.toISOString() : String(view.updatedAt),
    slaBreached: view.slaBreached,
    exceptionFlag: view.exceptionFlag,
    cancellation: view.cancellation
      ? {
          cancelledBy: view.cancellation.cancelledBy,
          reason: view.cancellation.reason,
          at: view.cancellation.at instanceof Date ? view.cancellation.at.toISOString() : String(view.cancellation.at),
        }
      : null,
    failureReason: view.failureReason,
    total: view.total,
  };
}
