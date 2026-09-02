import { RiderQueueView } from '../../../domain/fulfillment/repositories/IFulfillmentQueryRepository';

export interface RiderQueueItemResponse {
  fulfillmentId: string;
  assignmentStatus: string;
  attempt: number;
  expiresAt: string | null;
  restaurantId: string;
  deliveryAddress: {
    label?: string;
    street: string;
    city: string;
    state: string;
    pinCode: string;
    coordinates: { lat: number; lng: number };
  };
  total: { amount: number; currency: string };
  fulfillmentStatus: string;
  offeredAt: string;
  updatedAt: string;
}

export function toRiderQueueItemResponse(view: RiderQueueView): RiderQueueItemResponse {
  return {
    fulfillmentId: view.fulfillmentId,
    assignmentStatus: view.assignmentStatus,
    attempt: view.attempt,
    expiresAt: view.expiresAt
      ? (view.expiresAt instanceof Date ? view.expiresAt.toISOString() : String(view.expiresAt))
      : null,
    restaurantId: view.restaurantId,
    deliveryAddress: view.deliveryAddress,
    total: view.total,
    fulfillmentStatus: view.fulfillmentStatus,
    offeredAt: view.offeredAt instanceof Date ? view.offeredAt.toISOString() : String(view.offeredAt),
    updatedAt: view.updatedAt instanceof Date ? view.updatedAt.toISOString() : String(view.updatedAt),
  };
}
