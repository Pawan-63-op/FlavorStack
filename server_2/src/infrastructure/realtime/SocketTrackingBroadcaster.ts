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
