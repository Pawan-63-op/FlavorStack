import { FailureReasonValue } from '../../../domain/fulfillment/enums/failure-reason.enum';

export interface FailDeliveryDto {
  fulfillmentId: string;
  failureReason: FailureReasonValue;
  riderId?: string;
}
