export interface RealtimeConfig {
  trackingPersistThrottleSeconds: number;
  trackingLatestTtlSeconds: number;
  corsOrigin: string;
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
