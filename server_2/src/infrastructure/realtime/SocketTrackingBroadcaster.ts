// SocketTrackingBroadcaster — implements ITrackingBroadcaster over the Socket.IO `/tracking`
// namespace (fulfillment_module.md §9, Phase 7).
//
// Late-bound on purpose: the container constructs this broadcaster (so RecordRiderLocation and
// TrackingStatusBridge can depend on it during bootstrap), but the Socket.IO namespace only exists
// AFTER the HTTP server is listening (server.ts). `attach(namespace)` wires the real target; until
// then broadcasts are no-ops (no clients are connected pre-listen anyway). The Socket.IO Redis
// adapter on the namespace fans `.to(room).emit(...)` out across every instance.
import type { Namespace } from 'socket.io';
import {
  ITrackingBroadcaster,
  TrackingLocationPayload,
  TrackingStatusPayload,
} from '../../application/fulfillment/ports/ITrackingBroadcaster';
import { trackingRoom, TRACKING_LOCATION_EVENT, TRACKING_STATUS_EVENT } from './rooms';

export class SocketTrackingBroadcaster implements ITrackingBroadcaster {
  private namespace: Namespace | null = null;

  /** Bind the live Socket.IO namespace once it has been created (post-listen). */
  attach(namespace: Namespace): void {
    this.namespace = namespace;
  }

  broadcastLocation(fulfillmentId: string, payload: TrackingLocationPayload): void {
    this.namespace?.to(trackingRoom(fulfillmentId)).emit(TRACKING_LOCATION_EVENT, payload);
  }

  broadcastStatus(fulfillmentId: string, payload: TrackingStatusPayload): void {
    this.namespace?.to(trackingRoom(fulfillmentId)).emit(TRACKING_STATUS_EVENT, payload);
  }
}
