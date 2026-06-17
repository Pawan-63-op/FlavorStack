// Input for FailDelivery (fulfillment_module.md §6.1, Phase 5B).
// riderId is present for the rider-driven path (/fulfillments/:id/fail) and omitted for an admin fail.
import { FailureReasonValue } from '../../../domain/fulfillment/enums/failure-reason.enum';

export interface FailDeliveryDto {
  fulfillmentId: string;
  failureReason: FailureReasonValue;
  riderId?: string;
}
