// Realtime (Socket.IO tracking) tunables (fulfillment_module.md §9, Phase 7). One source for the
// GPS persistence throttle, the Redis latest-location TTL, and the WS CORS origin.
export interface RealtimeConfig {
  // Mongo `delivery_tracking` persistence throttle — at most ~1 write / window / fulfillment.
  trackingPersistThrottleSeconds: number;
  // TTL on the Redis latest-location key so stale deliveries self-expire.
  trackingLatestTtlSeconds: number;
  // Allowed WS origin(s) for the Socket.IO handshake. '*' in dev; lock down in prod.
  corsOrigin: string;
  // Socket.IO mount path (defaults to the library default).
  path: string;
}

export function getRealtimeConfig(): RealtimeConfig {
  return {
    trackingPersistThrottleSeconds: Number(process.env.TRACKING_PERSIST_THROTTLE_SECONDS ?? 7),
    trackingLatestTtlSeconds: Number(process.env.TRACKING_LATEST_TTL_SECONDS ?? 3600),
    corsOrigin: process.env.REALTIME_CORS_ORIGIN ?? '*',
    path: process.env.REALTIME_SOCKET_PATH ?? '/socket.io',
  };
}
