// Tracking namespace — room per order, rider emits GPS every ~5s (fulfillment_module.md §9, Phase 7).
//
// Flow:
//   ┌─ CUSTOMER socket ─┐                      ┌─ RIDER socket ─┐
//   │ emit `subscribe`  │                      │ emit `location`│  every ~5s
//   │   { fulfillmentId}│                      │ {id,lat,lng}   │
//   └─────────┬─────────┘                      └───────┬────────┘
//             │ ownership via GetLiveTracking          │ ownership + persist via RecordRiderLocation
//             ▼                                         ▼
//      join room `fulfillment:{id}`            RecordRiderLocation → Redis latest + throttled Mongo
//             │                                         │  → broadcastLocation()
//             │◀──── `tracking:location` / `tracking:status` (Redis adapter fans out cross-instance) ──┘
//
// Authorization is enforced per action (never trust the client): customers may only join rooms for
// orders they own; riders may only push locations for deliveries they are the ACCEPTED rider of.
import type { Namespace } from 'socket.io';
import { RecordRiderLocation } from '../../../application/fulfillment/use-cases/RecordRiderLocation';
import { GetLiveTracking } from '../../../application/fulfillment/use-cases/GetLiveTracking';
import { USER_ROLE } from '../../../domain/identity/enums/user-role.enum';
import { logger } from '../../observability/logger';
import { trackingRoom } from '../rooms';
import { socketAuth, SocketUser } from '../middleware/socketAuth';
import { ITokenService } from '../../../domain/identity/services/ITokenService';

export interface TrackingNamespaceDeps {
  tokenService: ITokenService;
  recordRiderLocation: RecordRiderLocation;
  getLiveTracking: GetLiveTracking;
}

interface SubscribePayload {
  fulfillmentId?: unknown;
}
interface LocationPayload {
  fulfillmentId?: unknown;
  lat?: unknown;
  lng?: unknown;
}

type Ack = (response: { ok: boolean; error?: string }) => void;

function callAck(ack: unknown, response: { ok: boolean; error?: string }): void {
  if (typeof ack === 'function') (ack as Ack)(response);
}

/** Result.getError() is `string | DomainError`; normalize to a client-safe message. */
function errorMessage(error: string | { message: string }): string {
  return typeof error === 'string' ? error : error.message;
}

/** Attaches the `/tracking` namespace (JWT-gated) onto an existing Socket.IO server. */
export function registerTrackingNamespace(
  namespace: Namespace,
  deps: TrackingNamespaceDeps
): Namespace {
  namespace.use(socketAuth(deps.tokenService));

  namespace.on('connection', (socket) => {
    const user = socket.data.user as SocketUser;
    logger.info({ event: 'tracking.connect', userId: user.userId, role: user.role }, 'tracking socket connected');

    // Optional auto-subscribe for customers passing ?fulfillmentId= on the handshake.
    const initial = socket.handshake.query.fulfillmentId;
    if (user.role === USER_ROLE.CUSTOMER && typeof initial === 'string' && initial.length > 0) {
      void subscribeCustomer(initial);
    }

    // ── CUSTOMER: join an order's room (ownership-checked) to receive location + status ──────────
    async function subscribeCustomer(fulfillmentId: string): Promise<void> {
      const result = await deps.getLiveTracking.execute({ fulfillmentId, customerId: user.userId });
      if (result.isFailure) {
        socket.emit('tracking:error', { fulfillmentId, error: errorMessage(result.getError()) });
        return;
      }
      await socket.join(trackingRoom(fulfillmentId));
      socket.emit('tracking:subscribed', { fulfillmentId, snapshot: result.getValue() });
    }

    socket.on('subscribe', (payload: SubscribePayload, ack?: unknown) => {
      const fulfillmentId = typeof payload?.fulfillmentId === 'string' ? payload.fulfillmentId : '';
      if (!fulfillmentId) {
        callAck(ack, { ok: false, error: 'fulfillmentId required' });
        return;
      }
      if (user.role !== USER_ROLE.CUSTOMER) {
        callAck(ack, { ok: false, error: 'only customers may subscribe' });
        return;
      }
      void subscribeCustomer(fulfillmentId).then(() => callAck(ack, { ok: true }));
    });

    socket.on('unsubscribe', (payload: SubscribePayload) => {
      const fulfillmentId = typeof payload?.fulfillmentId === 'string' ? payload.fulfillmentId : '';
      if (fulfillmentId) void socket.leave(trackingRoom(fulfillmentId));
    });

    // ── RIDER: push GPS. RecordRiderLocation validates ownership, persists, and broadcasts. ──────
    socket.on('location', (payload: LocationPayload, ack?: unknown) => {
      if (user.role !== USER_ROLE.DRIVER) {
        callAck(ack, { ok: false, error: 'only riders may push location' });
        return;
      }
      const fulfillmentId = typeof payload?.fulfillmentId === 'string' ? payload.fulfillmentId : '';
      const lat = Number(payload?.lat);
      const lng = Number(payload?.lng);
      if (!fulfillmentId) {
        callAck(ack, { ok: false, error: 'fulfillmentId required' });
        return;
      }

      void deps.recordRiderLocation
        .execute({ fulfillmentId, riderId: user.userId, lat, lng })
        .then((result) => {
          if (result.isFailure) {
            callAck(ack, { ok: false, error: errorMessage(result.getError()) });
            return;
          }
          // Auto-join the rider to the room so they also receive `tracking:status`.
          void socket.join(trackingRoom(fulfillmentId));
          callAck(ack, { ok: true });
        })
        .catch((err: unknown) => {
          logger.error({ event: 'tracking.location.error', err }, 'failed to record rider location');
          callAck(ack, { ok: false, error: 'internal error' });
        });
    });

    socket.on('disconnect', (reason) => {
      logger.info({ event: 'tracking.disconnect', userId: user.userId, reason }, 'tracking socket disconnected');
    });
  });

  return namespace;
}
