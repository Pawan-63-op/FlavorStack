// Input for AcceptDelivery — the offered rider accepts (fulfillment_module.md §6.1, Phase 3B).
// riderId is the authenticated rider; the aggregate enforces it matches the offered rider.
export interface AcceptDeliveryDto {
  fulfillmentId: string;
  riderId: string;
}
