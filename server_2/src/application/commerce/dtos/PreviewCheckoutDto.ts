// Input DTO: PreviewCheckout (Commerce Phase 11 Batch 3) — a dry-run pricing request for the customer's
// active cart against a delivery point. No idempotency key or payment method (those belong to the committing
// Checkout, Batch 4): preview only needs who is asking and where delivery would go, to resolve serviceability,
// the delivery fee and the full pricing breakdown without persisting anything.
export interface PreviewCheckoutDto {
  customerId: string;
  deliveryPoint: {
    lat: number;
    lng: number;
  };
}
