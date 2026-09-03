import { CancelledByValue } from '../../../domain/fulfillment/enums/cancelled-by.enum';

/**
 * Cancellation by the platform itself: the admin console (`SYSTEM`, ownership-exempt) and the
 * SLA / assignment timeout handlers. The caller has already established its own authority, so it
 * states `cancelledBy` outright.
 */
export interface CancelFulfillmentBySystemDto {
  fulfillmentId: string;
  cancelledBy: CancelledByValue;
  reason: string;
  actorId?: string;
}

/**
 * Cancellation by an authenticated end user. The use case — not the controller — decides whether
 * `actorUserId` is this order's customer or the owner of its restaurant, because only it can read
 * the fulfillment and ask `IRestaurantDirectory` who owns the restaurant.
 */
export interface CancelFulfillmentByActorDto {
  fulfillmentId: string;
  actorUserId: string;
  reason: string;
}

export type CancelFulfillmentDto = CancelFulfillmentBySystemDto | CancelFulfillmentByActorDto;

export function isActorCancellation(dto: CancelFulfillmentDto): dto is CancelFulfillmentByActorDto {
  return 'actorUserId' in dto;
}
