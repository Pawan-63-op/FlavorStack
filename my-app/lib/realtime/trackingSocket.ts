import { io, type Socket } from "socket.io-client";
import type { TrackingResponse } from "../api/adapters/tracking";

/**
 * Isolated Socket.IO client for server_2's JWT-gated `/tracking` namespace
 * (Phase 7, Batch 7.4). Mirrors the singleton pattern of the chat socket
 * (`hooks_/useSocket.ts`) but lives in its own module and connection so the
 * two never interfere — this file must NOT touch chat.
 *
 * Auth is by cookie (`withCredentials`): the session cookie is first-party on
 * `localhost`, so a handshake to the server_2 origin carries it. The server
 * authorizes per action (`subscribe` ownership-checked), never trusting the
 * client — see `server_2/.../realtime/namespaces/tracking.ts`.
 */

/** Server→client events on the `/tracking` namespace. */
export const TRACKING_EVENT = {
  SUBSCRIBED: "tracking:subscribed",
  ERROR: "tracking:error",
  STATUS: "tracking:status",
  LOCATION: "tracking:location",
} as const;

/** `tracking:subscribed` — ack of a successful subscribe; `snapshot` is the same
 * shape as `GET /fulfillments/:id/tracking` (`TrackingResponse`). */
export interface TrackingSubscribedEvent {
  fulfillmentId: string;
  snapshot: TrackingResponse;
}

/** `tracking:error` — ownership/validation failure for a `subscribe`. */
export interface TrackingErrorEvent {
  fulfillmentId: string;
  error: string;
}

/** `tracking:status` — a live fulfillment/delivery status advance. */
export interface TrackingStatusEvent {
  fulfillmentId: string;
  status: string;
  at: string;
  riderId?: string | null;
}

/** `tracking:location` — a live rider GPS ping. */
export interface TrackingLocationEvent {
  fulfillmentId: string;
  riderId: string;
  lat: number;
  lng: number;
  recordedAt: string;
}

const NAMESPACE = "/tracking";

/**
 * Full URL for the `/tracking` namespace. `NEXT_PUBLIC_SOCKET_URL` points at the
 * server_2 origin (e.g. `http://localhost:3000`) because the Next dev rewrite
 * only proxies `/api/v1/*`, not the Socket.IO `/socket.io` path — the WS must
 * connect directly. Empty → same-origin (page origin).
 */
export function trackingSocketUrl(): string {
  const base = (process.env.NEXT_PUBLIC_SOCKET_URL ?? "").replace(/\/+$/, "");
  return `${base}${NAMESPACE}`;
}

let socketInstance: Socket | null = null;

/** Lazily-created singleton connection to `/tracking`, shared across remounts. */
export function getTrackingSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(trackingSocketUrl(), {
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      transports: ["websocket"],
    });
  }
  return socketInstance;
}

/** Join a fulfillment's room (server acks ok/err; ownership-checked). */
export function subscribeTracking(socket: Socket, fulfillmentId: string): void {
  socket.emit("subscribe", { fulfillmentId });
}

/** Leave a fulfillment's room. */
export function unsubscribeTracking(socket: Socket, fulfillmentId: string): void {
  socket.emit("unsubscribe", { fulfillmentId });
}

/** Test-only: tear down the singleton so each test gets a fresh mock `io`. */
export function __resetTrackingSocket(): void {
  if (socketInstance) socketInstance.disconnect();
  socketInstance = null;
}
