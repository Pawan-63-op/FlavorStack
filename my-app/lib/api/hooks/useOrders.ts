"use client";

import { useQueries } from "@tanstack/react-query";
import type { OrderConfirmationVM } from "../adapters/checkout";
import type { CustomerOrderVM } from "../adapters/orders";
import { queryKeys } from "../queryKeys";
import { checkoutService } from "../services/checkout";
import { getTrackedOrders, type TrackedOrder } from "../../orders/trackedOrders";
import { useMyOrders } from "./useMyOrders";

/** One row in the order history list: the local fallback plus its live fetch state. */
export interface TrackedOrderItem {
  tracked: TrackedOrder;
  order?: OrderConfirmationVM;
  isLoading: boolean;
  isError: boolean;
}

interface OrderQueryResult {
  data?: OrderConfirmationVM;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Pure merge of tracked orders with their per-id query results, so a failed or
 * still-loading id degrades to its locally-stored fallback (restaurant name,
 * total) rather than blanking the whole list. Exported for testing in isolation
 * from `useQueries`.
 */
export function mergeTrackedOrderResults(
  tracked: TrackedOrder[],
  results: OrderQueryResult[],
): TrackedOrderItem[] {
  return tracked.map((t, i) => {
    const result = results[i];
    return {
      tracked: t,
      order: result?.data,
      isLoading: result?.isLoading ?? false,
      isError: result?.isError ?? false,
    };
  });
}

/**
 * Merges the server order list (truth) with the localStorage cache into the
 * `TrackedOrder` rows the history UI renders (Phase 15 / G2). Server truth is
 * authoritative for *which* orders exist, their live `fulfillmentStatus`, total
 * and `fulfillmentId`; the cache supplies the `restaurantName`/`idempotencyKey`
 * the `/me/orders` projection doesn't carry. A just-placed order still only in
 * the cache (not yet projected) is appended so it doesn't vanish. When the
 * server list is unavailable (loading/errored, `undefined`) the cache is used
 * as the fallback — so a fresh browser with a reachable server now sees *all*
 * the customer's orders cross-device, not just locally-tracked ones. Pure/testable.
 */
export function mergeServerAndCache(
  serverOrders: CustomerOrderVM[] | undefined,
  cached: TrackedOrder[],
): TrackedOrder[] {
  if (!serverOrders) return cached;
  const cacheByOrder = new Map(cached.map((o) => [o.orderRequestId, o]));
  const fromServer: TrackedOrder[] = serverOrders.map((s) => {
    const c = cacheByOrder.get(s.orderRequestId);
    return {
      orderRequestId: s.orderRequestId,
      restaurantName: c?.restaurantName ?? "Restaurant",
      total: s.total,
      createdAt: s.placedAt,
      idempotencyKey: c?.idempotencyKey ?? "",
      fulfillmentId: s.fulfillmentId,
      lastKnownStatus: s.fulfillmentStatus,
    };
  });
  const serverIds = new Set(serverOrders.map((s) => s.orderRequestId));
  const cacheOnly = cached.filter((c) => !serverIds.has(c.orderRequestId));
  return [...fromServer, ...cacheOnly];
}

/**
 * Server-truth order history (Phase 15 / G2). Reads the customer's orders from
 * `GET /me/orders` (via `useMyOrders`) and merges the localStorage cache as a
 * fallback (`mergeServerAndCache`); per-order detail (line items, address,
 * payment for the details dialog) is still hydrated by fanning out
 * `GET /order-requests/:id`. Replaces the Phase 7 client-only approach where the
 * list came purely from `trackedOrders` localStorage. Newest-updated first
 * (server ordering).
 */
export function useTrackedOrders(): {
  items: TrackedOrderItem[];
  isLoading: boolean;
} {
  const cached = getTrackedOrders();
  const { data: serverOrders, isLoading: serverLoading } = useMyOrders();
  const tracked = mergeServerAndCache(serverOrders, cached);

  const results = useQueries({
    queries: tracked.map((t) => ({
      queryKey: queryKeys.orderRequests.detail(t.orderRequestId),
      queryFn: () => checkoutService.getOrderRequest(t.orderRequestId),
      staleTime: 30_000,
    })),
  });

  return {
    items: mergeTrackedOrderResults(tracked, results),
    isLoading: serverLoading || (tracked.length > 0 && results.every((r) => r.isLoading)),
  };
}
