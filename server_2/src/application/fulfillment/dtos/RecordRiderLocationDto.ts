// Input DTO for RecordRiderLocation (fulfillment_module.md §6.1 / §7.2, Phase 7).
// `riderId` is the authenticated rider (from the HTTP token or the socket handshake), never trusted
// from the body — the use case checks it owns the fulfillment.
export interface RecordRiderLocationDto {
  fulfillmentId: string;
  riderId: string;
  lat: number;
  lng: number;
}
