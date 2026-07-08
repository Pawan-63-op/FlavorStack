export interface TrackingLocationPayload {
  fulfillmentId: string;
  riderId: string;
  lat: number;
  lng: number;
  recordedAt: string; // ISO-8601
}

export interface TrackingStatusPayload {
  fulfillmentId: string;
  status: string;
  at: string; // ISO-8601
  riderId?: string | null;
}

export interface ITrackingBroadcaster {
  /** Emits `tracking:location` to the fulfillment room. */
  broadcastLocation(fulfillmentId: string, payload: TrackingLocationPayload): void;

  /** Emits `tracking:status` to the fulfillment room. */
  broadcastStatus(fulfillmentId: string, payload: TrackingStatusPayload): void;
}
