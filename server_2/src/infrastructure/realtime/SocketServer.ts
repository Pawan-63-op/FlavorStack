import type { Server as HttpServer } from 'http';
import { Server, Namespace } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import { RedisClient } from '../redis/client';
import { getRealtimeConfig, RealtimeConfig } from '../../config/realtime';
import { ITokenService } from '../../domain/identity/services/ITokenService';
import { RecordRiderLocation } from '../../application/fulfillment/use-cases/RecordRiderLocation';
import { GetLiveTracking } from '../../application/fulfillment/use-cases/GetLiveTracking';
import { SocketTrackingBroadcaster } from './SocketTrackingBroadcaster';
import { registerTrackingNamespace } from './namespaces/tracking';
import { logger } from '../observability/logger';

const TRACKING_NAMESPACE = '/tracking';

export interface SocketServerDeps {
  tokenService: ITokenService;
  recordRiderLocation: RecordRiderLocation;
  getLiveTracking: GetLiveTracking;
  /** The late-bound broadcaster the application layer already holds; we attach the namespace to it. */
  broadcaster: SocketTrackingBroadcaster;
}

export interface SocketServerHandle {
  io: Server;
  trackingNamespace: Namespace;
  close(): Promise<void>;
}

/**
 * Builds the realtime layer on top of an already-listening HTTP server. Creates the Redis adapter
 * from two duplicated ioredis connections (pub/sub), mounts `/tracking`, and binds the broadcaster.
 */
export async function createSocketServer(
  httpServer: HttpServer,
  redisClient: RedisClient,
  deps: SocketServerDeps,
  config: RealtimeConfig = getRealtimeConfig()
): Promise<SocketServerHandle> {
  const io = new Server(httpServer, {
    path: config.path,
    cors: { origin: config.corsOrigin, credentials: true },
  });

  const pubClient: Redis = redisClient.getClient().duplicate();
  const subClient: Redis = pubClient.duplicate();
  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));

  const trackingNamespace = io.of(TRACKING_NAMESPACE);
  registerTrackingNamespace(trackingNamespace, {
    tokenService: deps.tokenService,
    recordRiderLocation: deps.recordRiderLocation,
    getLiveTracking: deps.getLiveTracking,
  });

  deps.broadcaster.attach(trackingNamespace);

  logger.info({ event: 'socket.ready', namespace: TRACKING_NAMESPACE }, 'Socket.IO tracking namespace ready');

  return {
    io,
    trackingNamespace,
    async close(): Promise<void> {
      await new Promise<void>((resolve) => io.close(() => resolve()));
      pubClient.disconnect();
      subClient.disconnect();
    },
  };
}
