import { CustomerTrackingView } from '../../../domain/fulfillment/repositories/IFulfillmentProjectionRepository';

export interface TrackingTimelineEntryResponse {
  status: string;
  at: string; // ISO string
  note?: string;
}

export interface TrackingResponse {
  fulfillmentId: string;
  orderRequestId: string;
  currentStatus: string;
  deliveryStatus: string;
  riderId: string | null;
  timeline: TrackingTimelineEntryResponse[];
  deliveryAddress: {
    label?: string;
    street: string;
    city: string;
    state: string;
    pinCode: string;
    coordinates: { lat: number; lng: number };
  };
  total: { amount: number; currency: string };
  cancellation: { cancelledBy: string; reason: string; at: string } | null;
  failureReason: string | null;
  updatedAt: string;
}

export function toTrackingResponse(view: CustomerTrackingView): TrackingResponse {
  return {
    fulfillmentId: view.fulfillmentId,
    orderRequestId: view.orderRequestId,
    currentStatus: view.currentStatus,
    deliveryStatus: view.deliveryStatus,
    riderId: view.riderId,
    timeline: view.timeline.map((t) => ({
      status: t.status,
      at: t.at instanceof Date ? t.at.toISOString() : String(t.at),
      note: t.note,
    })),
    deliveryAddress: view.deliveryAddress,
    total: view.total,
    cancellation: view.cancellation
      ? {
          cancelledBy: view.cancellation.cancelledBy,
          reason: view.cancellation.reason,
          at: view.cancellation.at instanceof Date ? view.cancellation.at.toISOString() : String(view.cancellation.at),
        }
      : null,
    failureReason: view.failureReason,
    updatedAt: view.updatedAt instanceof Date ? view.updatedAt.toISOString() : String(view.updatedAt),
  };
}
