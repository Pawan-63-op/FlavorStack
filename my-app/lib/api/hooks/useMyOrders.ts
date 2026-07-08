"use client";

import { useEffect } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { queryKeys } from "../queryKeys";
import { ordersService } from "../services/orders";
import { setFulfillmentId, updateTrackedStatus } from "../../orders/trackedOrders";
import type { CustomerOrderVM } from "../adapters/orders";

/**
 * Server-truth order list (Phase 15 / G1) — `GET /me/orders` via `ordersService`.
 * Each successful fetch seeds the `trackedOrders` localStorage cache with the
 * discovered `orderRequestId → fulfillmentId` linkage + latest status, so the
 * client cache becomes a mirror of server truth rather than the source. Disabled
 * via `enabled: false` when a caller only needs it conditionally.
 */
export function useMyOrders(
  options: { enabled?: boolean } = {},
): UseQueryResult<CustomerOrderVM[]> {
  const { enabled = true } = options;
  const query = useQuery({
    queryKey: queryKeys.orders.myList(),
    queryFn: () => ordersService.listMyOrders(),
    enabled,
  });

  useEffect(() => {
    if (!query.data) return;
    for (const order of query.data) {
      setFulfillmentId(order.orderRequestId, order.fulfillmentId);
      updateTrackedStatus(order.orderRequestId, order.fulfillmentStatus);
    }
  }, [query.data]);

  return query;
}

/**
 * Pure lookup of an order's `fulfillmentId` within a server order list. Returns
 * `null` when the id is absent (no order list, no match, or no id to resolve).
 * Exported for testing in isolation from the query hook.
 */
export function pickFulfillmentId(
  orders: CustomerOrderVM[] | undefined,
  orderRequestId: string | null,
): string | null {
  if (!orderRequestId || !orders) return null;
  return orders.find((order) => order.orderRequestId === orderRequestId)?.fulfillmentId ?? null;
}

/**
 * Resolves the `fulfillmentId` for a given `orderRequestId` from server truth,
 * closing the order↔fulfillment linkage gap (G1): the customer's order screen
 * can now show live tracking instead of being stuck on the static confirmation.
 * Pass `null` to skip the fetch (e.g. when the id is already cached locally).
 */
export function useResolveFulfillmentId(orderRequestId: string | null): {
  fulfillmentId: string | null;
  isLoading: boolean;
} {
  const { data, isLoading } = useMyOrders({ enabled: Boolean(orderRequestId) });
  return { fulfillmentId: pickFulfillmentId(data, orderRequestId), isLoading };
}
