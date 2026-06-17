// Input for ConfirmPickup — the assigned rider collects the food (fulfillment_module.md §6.1, Phase 4).
// riderId is the authenticated rider; the aggregate enforces it matches the accepted assignment.
export interface ConfirmPickupDto {
  fulfillmentId: string;
  riderId: string;
}
