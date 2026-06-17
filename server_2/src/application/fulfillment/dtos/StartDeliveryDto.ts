// Input for StartDelivery — the assigned rider departs for the customer (fulfillment_module.md §6.1, Phase 4).
// riderId is the authenticated rider; the aggregate enforces it matches the accepted assignment.
export interface StartDeliveryDto {
  fulfillmentId: string;
  riderId: string;
}
