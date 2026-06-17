// Input for AssignRider — admin manual (re)assignment. When riderId is omitted, the next candidate
// is chosen by IDeliveryAssignmentService (fulfillment_module.md §6.1 / §7.4, Phase 3B).
export interface AssignRiderDto {
  fulfillmentId: string;
  riderId?: string;
}
