"use client";

import { useEffect, useReducer } from "react";
import {
  TRACKING_EVENT,
  getTrackingSocket,
  subscribeTracking,
  unsubscribeTracking,
  type TrackingErrorEvent,
  type TrackingLocationEvent,
  type TrackingStatusEvent,
  type TrackingSubscribedEvent,
} from "@/lib/realtime/trackingSocket";
import type { TrackingResponse } from "@/lib/api/adapters/tracking";
import { setFulfillmentId, updateTrackedStatus } from "@/lib/orders/trackedOrders";

/**
 * Live tracking over the `/tracking` Socket.IO namespace (Phase 7, Batch 7.4).
 * Subscribes on mount for a `fulfillmentId`, exposes the subscribe snapshot plus
 * the latest live status/location and connection/error state, and unsubscribes
 * on unmount. The socket is authoritative when connected; `OrderTracking` falls
 * back to the Batch 7.3 HTTP query when it isn't.
 */
export interface TrackingSocketState {
  connected: boolean;
  /** `tracking:subscribed` snapshot — same shape as `GET /fulfillments/:id/tracking`. */
  snapshot: TrackingResponse | null;
  /** Latest `tracking:status` advance, if any. */
  status: TrackingStatusEvent | null;
  /** Latest `tracking:location` rider ping, if any. */
  latestLocation: TrackingLocationEvent | null;
  /** Friendly message from `tracking:error` (e.g. not owner / unknown id). */
  error: string | null;
}

export const INITIAL_TRACKING_SOCKET_STATE: TrackingSocketState = {
  connected: false,
  snapshot: null,
  status: null,
  latestLocation: null,
  error: null,
};

export type TrackingSocketAction =
  | { type: "connected" }
  | { type: "disconnected" }
  | { type: "subscribed"; snapshot: TrackingResponse }
  | { type: "status"; event: TrackingStatusEvent }
  | { type: "location"; event: TrackingLocationEvent }
  | { type: "error"; message: string }
  | { type: "reset" };

/** Pure state machine for the live tracking stream — exported for unit testing. */
export function trackingSocketReducer(
  state: TrackingSocketState,
  action: TrackingSocketAction,
): TrackingSocketState {
  switch (action.type) {
    case "connected":
      return { ...state, connected: true, error: null };
    case "disconnected":
      return { ...state, connected: false };
    case "subscribed":
      return { ...state, snapshot: action.snapshot, error: null };
    case "status":
      return { ...state, status: action.event };
    case "location":
      return { ...state, latestLocation: action.event };
    case "error":
      return { ...state, error: action.message };
    case "reset":
      return INITIAL_TRACKING_SOCKET_STATE;
    default:
      return state;
  }
}

/**
 * Persists the order↔fulfillment mapping + latest status from a socket snapshot,
 * closing the linkage gap (Phase_7.md) for future loads — the snapshot carries
 * both ids, so a live subscribe can fill the cache even when HTTP never runs.
 * Pure so it's testable without mounting the hook.
 */
export function syncTrackedOrderFromSnapshot(snapshot: TrackingResponse): void {
  setFulfillmentId(snapshot.orderRequestId, snapshot.fulfillmentId);
  updateTrackedStatus(snapshot.orderRequestId, snapshot.currentStatus);
}

export function useTrackingSocket(fulfillmentId: string | null): TrackingSocketState {
  const [state, dispatch] = useReducer(trackingSocketReducer, INITIAL_TRACKING_SOCKET_STATE);

  useEffect(() => {
    if (!fulfillmentId) {
      dispatch({ type: "reset" });
      return;
    }

    const socket = getTrackingSocket();

    const onConnect = () => dispatch({ type: "connected" });
    const onDisconnect = () => dispatch({ type: "disconnected" });
    const onSubscribed = (e: TrackingSubscribedEvent) => {
      if (e.fulfillmentId !== fulfillmentId) return;
      dispatch({ type: "subscribed", snapshot: e.snapshot });
      syncTrackedOrderFromSnapshot(e.snapshot);
    };
    const onStatus = (e: TrackingStatusEvent) => {
      if (e.fulfillmentId !== fulfillmentId) return;
      dispatch({ type: "status", event: e });
    };
    const onLocation = (e: TrackingLocationEvent) => {
      if (e.fulfillmentId !== fulfillmentId) return;
      dispatch({ type: "location", event: e });
    };
    const onError = (e: TrackingErrorEvent) => {
      if (e.fulfillmentId && e.fulfillmentId !== fulfillmentId) return;
      dispatch({ type: "error", message: e.error });
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on(TRACKING_EVENT.SUBSCRIBED, onSubscribed);
    socket.on(TRACKING_EVENT.STATUS, onStatus);
    socket.on(TRACKING_EVENT.LOCATION, onLocation);
    socket.on(TRACKING_EVENT.ERROR, onError);

    if (socket.connected) dispatch({ type: "connected" });
    subscribeTracking(socket, fulfillmentId);

    return () => {
      unsubscribeTracking(socket, fulfillmentId);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off(TRACKING_EVENT.SUBSCRIBED, onSubscribed);
      socket.off(TRACKING_EVENT.STATUS, onStatus);
      socket.off(TRACKING_EVENT.LOCATION, onLocation);
      socket.off(TRACKING_EVENT.ERROR, onError);
    };
  }, [fulfillmentId]);

  return state;
}
