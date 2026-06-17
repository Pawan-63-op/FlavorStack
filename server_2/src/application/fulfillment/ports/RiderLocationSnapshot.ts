// A single rider GPS sample for one fulfillment (fulfillment_module.md §9, Phase 7).
// Deliberately NOT a domain value object — high-frequency GPS pings live outside the
// Fulfillment aggregate (§2.3) to avoid write amplification / contention.
export interface RiderLocationSnapshot {
  fulfillmentId: string;
  riderId: string;
  lat: number;
  lng: number;
  recordedAt: Date;
}
