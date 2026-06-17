// Input for CompleteDelivery — the assigned rider hands the order to the customer
// (fulfillment_module.md §6.1, Phase 4). riderId is the authenticated rider; the aggregate enforces
// it matches the accepted assignment. `proof` is an optional handover proof reference (captured but
// not yet persisted in the aggregate — proof storage is a future concern).
export interface CompleteDeliveryDto {
  fulfillmentId: string;
  riderId: string;
  proof?: string;
}
