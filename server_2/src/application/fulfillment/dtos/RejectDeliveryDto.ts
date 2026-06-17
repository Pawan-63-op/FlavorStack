// Input for RejectDelivery — the offered rider declines (fulfillment_module.md §6.1, Phase 3B).
// The rejected attempt is moved to history; a re-offer to the next candidate is then triggered.
export interface RejectDeliveryDto {
  fulfillmentId: string;
  riderId: string;
  reason?: string;
}
