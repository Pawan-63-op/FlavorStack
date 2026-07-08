"use client";

import { useEffect } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { queryKeys } from "../queryKeys";
import { driverService } from "../services/driver";
import type { RiderQueueItemView, RiderDeliveryHistoryView } from "../adapters/driver";

/**
 * Driver hooks (Phase 14.4) — TanStack wrappers over `driverService` for the
 * rider surface. The queue is the single source of state every action mutates,
 * so each mutation invalidates it on success (optimistic refresh) and the query
 * polls while the driver is online so newly-offered orders appear without a
 * manual reload.
 */

const QUEUE_POLL_INTERVAL_MS = 8_000;

/** Invalidate the driver's queue so the next render reflects the latest offers/deliveries. */
export function invalidateDriverQueue(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.driver.queue() });
}

/**
 * Rider queue query. Polls every {@link QUEUE_POLL_INTERVAL_MS} only while the
 * driver is online (`enabled`); offline drivers have no queue and skip the
 * fetch entirely. Pure cadence kept inline (no terminal items live in a queue).
 */
export function useRiderQueue(enabled: boolean): UseQueryResult<RiderQueueItemView[]> {
  return useQuery({
    queryKey: queryKeys.driver.queue(),
    queryFn: () => driverService.getQueue(),
    enabled,
    refetchInterval: enabled ? QUEUE_POLL_INTERVAL_MS : false,
  });
}

/**
 * Rider completed-delivery history + earnings (G19). Cheap read from the retained
 * admin projection; refetched on mount and whenever a delivery completes (see
 * {@link useCompleteDelivery}). Not polled — history only grows on a delivery.
 */
export function useRiderDeliveryHistory(
  enabled = true,
): UseQueryResult<RiderDeliveryHistoryView> {
  return useQuery({
    queryKey: queryKeys.driver.deliveries(),
    queryFn: () => driverService.getDeliveryHistory(),
    enabled,
  });
}

/** Go online/offline; refreshes the queue (online → fetch offers, offline → clear). */
export function useSetAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (available: boolean) => driverService.setAvailability(available),
    onSuccess: () => invalidateDriverQueue(queryClient),
  });
}

/** Accept the active offer; refreshes the queue. */
export function useAcceptDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => driverService.accept(id),
    onSuccess: () => invalidateDriverQueue(queryClient),
  });
}

/** Reject the active offer (optional reason); refreshes the queue. */
export function useRejectDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      driverService.reject(id, reason),
    onSuccess: () => invalidateDriverQueue(queryClient),
  });
}

/** Confirm pickup; refreshes the queue. */
export function useConfirmPickup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => driverService.pickup(id),
    onSuccess: () => invalidateDriverQueue(queryClient),
  });
}

/** Start the delivery (out for delivery); refreshes the queue. */
export function useStartDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => driverService.outForDelivery(id),
    onSuccess: () => invalidateDriverQueue(queryClient),
  });
}

/** Complete the delivery (optional proof); refreshes the queue and the history/earnings. */
export function useCompleteDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, proof }: { id: string; proof?: string }) =>
      driverService.deliver(id, proof),
    onSuccess: () => {
      invalidateDriverQueue(queryClient);
      void queryClient.invalidateQueries({ queryKey: queryKeys.driver.deliveries() });
    },
  });
}

/** Report a delivery failure with a required reason enum; refreshes the queue. */
export function useFailDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, failureReason }: { id: string; failureReason: string }) =>
      driverService.fail(id, failureReason),
    onSuccess: () => invalidateDriverQueue(queryClient),
  });
}

const LOCATION_PING_INTERVAL_MS = 15_000;

/**
 * Best-effort periodic GPS ping (`POST /fulfillments/:id/location`) for the one
 * out-for-delivery fulfillment, the HTTP fallback for the tracking socket. No-op
 * (and silently skipped) when there is no active delivery or the browser has no
 * Geolocation API; ping failures are swallowed so a denied permission never
 * breaks the delivery UI.
 */
export function useDriverLocationPing(activeFulfillmentId: string | null): void {
  useEffect(() => {
    if (!activeFulfillmentId) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    let cancelled = false;
    const ping = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          void driverService
            .recordLocation(activeFulfillmentId, pos.coords.latitude, pos.coords.longitude)
            .catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 10_000, timeout: 10_000 },
      );
    };

    ping();
    const timer = setInterval(ping, LOCATION_PING_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeFulfillmentId]);
}
