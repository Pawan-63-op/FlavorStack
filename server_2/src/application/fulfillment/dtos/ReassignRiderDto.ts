// Input for ReassignRider (fulfillment_module.md §6.1 / §7.4, Phase 5B).
// riderId names a specific replacement; when omitted the IDeliveryAssignmentService picks the next
// candidate (excluding everyone already tried on this fulfillment).
export interface ReassignRiderDto {
  fulfillmentId: string;
  riderId?: string;
}
