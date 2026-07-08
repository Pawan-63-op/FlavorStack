"use client";

import { useEffect } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { queryKeys } from "../queryKeys";
import { trackingService } from "../services/tracking";
import { CANCELLABLE_FULFILLMENT_STATUSES } from "../adapters/fulfillmentAdmin";
import { setFulfillmentId, updateTrackedStatus } from "../../orders/trackedOrders";
import type { TrackingView } from "../adapters/tracking";

const POLL_INTERVAL_MS = 10_000;

/**
 * HTTP refetch cadence for the tracking detail screen: polls while the
 * fulfillment is still in flight, stops once `isTerminal` (DELIVERED/
 * CANCELLED/FAILED) since no further updates will ever arrive. Batch 7.4 makes
 * the socket authoritative — when it's connected, polling is disabled and the
 * HTTP query only serves as the disconnect fallback. Pure so it's testable
 * without mounting a query.
 */
export function trackingRefetchInterval(
  data: TrackingView | undefined,
  socketConnected = false,
): number | false {
  if (socketConnected) return false;
  if (!data) return POLL_INTERVAL_MS;
  return data.isTerminal ? false : POLL_INTERVAL_MS;
}

/**
 * Persists the order↔fulfillment mapping and latest status once a tracking
 * fetch succeeds, closing the linkage gap (Phase_7.md) for future loads —
 * the response carries both ids, so any successful fetch can fill the cache.
 */
export function syncTrackedOrderFromTracking(data: TrackingView): void {
  setFulfillmentId(data.orderRequestId, data.fulfillmentId);
  updateTrackedStatus(data.orderRequestId, data.currentStatus);
}

/**
 * Tracking detail query (Batch 7.3) — `GET /fulfillments/:id/tracking` via
 * `trackingService`. Disabled while `fulfillmentId` is unknown (the
 * order↔fulfillment linkage gap documented in Phase_7.md); HTTP polling is a
 * fallback ahead of the Batch 7.4 socket layer.
 */
export function useTracking(
  fulfillmentId: string | null,
  options: { socketConnected?: boolean } = {},
): UseQueryResult<TrackingView> {
  const { socketConnected = false } = options;
  const query = useQuery({
    queryKey: queryKeys.tracking.detail(fulfillmentId ?? ""),
    queryFn: () => trackingService.getTracking(fulfillmentId as string),
    enabled: Boolean(fulfillmentId),
    refetchInterval: ({ state }) => trackingRefetchInterval(state.data, socketConnected),
  });

  useEffect(() => {
    if (query.data) syncTrackedOrderFromTracking(query.data);
  }, [query.data]);

  return query;
}

/**
 * Whether a customer cancel is allowed from the given fulfillment status (G7).
 * Mirrors the server's accepted pre-pickup states (`CANCELLABLE_FULFILLMENT_
 * STATUSES`: CREATED / PREPARING / READY_FOR_PICKUP) so the button only shows
 * when the backend would honour the cancel. Pure so it's testable. A `null`/
 * unknown status is treated as not cancellable.
 */
export function isOrderCancellable(status: string | null | undefined): boolean {
  if (!status) return false;
  return (CANCELLABLE_FULFILLMENT_STATUSES as readonly string[]).includes(status);
}

/**
 * Customer cancel-order mutation (Phase 15 / G7) — `POST /fulfillments/:id/cancel`
 * with a required reason. On success it invalidates the order's tracking detail
 * (so the status flips to CANCELLED with its banner) and the `/me/orders` list.
 */
export function useCancelOrder(
  fulfillmentId: string | null,
): UseMutationResult<void, Error, { reason: string }> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reason }: { reason: string }) =>
      trackingService.cancelOrder(fulfillmentId as string, reason),
    onSuccess: () => {
      if (fulfillmentId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.tracking.detail(fulfillmentId) });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.myList() });
    },
  });
}
