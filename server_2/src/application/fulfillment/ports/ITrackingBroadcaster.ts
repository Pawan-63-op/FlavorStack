// Port for realtime fan-out to a fulfillment's tracking room (fulfillment_module.md §9, Phase 7).
// Implemented by infrastructure/realtime/SocketTrackingBroadcaster, which emits over the Socket.IO
// `/tracking` namespace. The Socket.IO Redis adapter handles multi-instance fan-out, so a
// broadcast on the node that received the ping reaches subscribers connected to any node.
//
// Keeping this as a port keeps the application layer free of Socket.IO and lets the realtime
// transport be swapped/stubbed in tests.
export interface TrackingLocationPayload {
  fulfillmentId: string;
  riderId: string;
  lat: number;
  lng: number;
  recordedAt: string; // ISO-8601
}

export interface TrackingStatusPayload {
  fulfillmentId: string;
  status: string; // the domain event name, e.g. OUT_FOR_DELIVERY / RiderAssigned
  at: string; // ISO-8601
  riderId?: string | null;
}

export interface ITrackingBroadcaster {
  /** Emits `tracking:location` to the fulfillment room. */
  broadcastLocation(fulfillmentId: string, payload: TrackingLocationPayload): void;

  /** Emits `tracking:status` to the fulfillment room. */
  broadcastStatus(fulfillmentId: string, payload: TrackingStatusPayload): void;
}
