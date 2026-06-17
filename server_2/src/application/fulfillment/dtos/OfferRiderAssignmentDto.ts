// Input for OfferRiderAssignment — system-driven offer; the rider is chosen by
// IDeliveryAssignmentService (fulfillment_module.md §6.1, Phase 3B).
export interface OfferRiderAssignmentDto {
  fulfillmentId: string;
}
