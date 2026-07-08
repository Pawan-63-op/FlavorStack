import { CancelledByValue } from '../../../domain/fulfillment/enums/cancelled-by.enum';

export interface CancelFulfillmentDto {
  fulfillmentId: string;
  cancelledBy: CancelledByValue;
  reason: string;
  actorId?: string;
}
