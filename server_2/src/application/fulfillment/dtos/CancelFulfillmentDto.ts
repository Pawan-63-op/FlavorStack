// Input for CancelFulfillment (fulfillment_module.md §6.1, Phase 5A).
// cancelledBy is resolved by the controller from the authenticated actor's role; actorId is the
// authenticated userId used for the ownership check (the customerId or restaurantId). For an admin
// (SYSTEM) cancellation actorId is omitted and the aggregate skips the ownership check.
import { CancelledByValue } from '../../../domain/fulfillment/enums/cancelled-by.enum';

export interface CancelFulfillmentDto {
  fulfillmentId: string;
  cancelledBy: CancelledByValue;
  reason: string;
  actorId?: string;
}
