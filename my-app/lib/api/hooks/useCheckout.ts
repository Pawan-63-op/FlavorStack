"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../../store/authStore";
import { addTrackedOrder } from "../../orders/trackedOrders";
import { queryKeys } from "../queryKeys";
import {
  checkoutService,
  type DeliveryPoint,
  type PlaceOrderInput,
  type PlaceOrderResult,
} from "../services/checkout";

/**
 * Checkout query + mutation hooks — thin TanStack wrappers over `checkoutService`
 * (Batch 6.3). Mirrors `useCart.ts`: reads are gated on the authenticated
 * session (every `/checkout*` route is auth-only), and the place-order mutation
 * seeds the returned confirmation straight into the `orderRequests.detail`
 * cache so the confirmation screen (Batch 6.4) renders without a refetch.
 */

/**
 * Live pricing preview for the chosen delivery point. Re-runs automatically when
 * the coordinates change (the key is derived from them); disabled until an
 * address is selected, so there is no preview request without coordinates.
 */
export function usePreviewCheckout(deliveryPoint: DeliveryPoint | null) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: deliveryPoint
      ? queryKeys.checkout.preview(deliveryPoint.lat, deliveryPoint.lng)
      : queryKeys.checkout.preview(0, 0),
    queryFn: () => checkoutService.preview(deliveryPoint as DeliveryPoint),
    enabled: isAuthenticated && deliveryPoint !== null,
  });
}

/**
 * Place the order (`POST /checkout`, idempotent). On success we persist the
 * `orderRequestId` for the client-tracked order list (Phase 7) and seed the
 * confirmation cache. Errors are surfaced to the caller via `mutateAsync` so
 * the checkout screen can toast and stay put rather than navigate.
 */
export function usePlaceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PlaceOrderInput) => checkoutService.checkout(input),
    onSuccess: (result: PlaceOrderResult) => {
      const { order, idempotencyKeyUsed } = result;
      queryClient.setQueryData(
        queryKeys.orderRequests.detail(order.orderRequestId),
        order,
      );
      addTrackedOrder({
        orderRequestId: order.orderRequestId,
        restaurantName: order.restaurantName,
        total: order.pricing.total,
        createdAt: order.createdAt,
        idempotencyKey: idempotencyKeyUsed,
      });
    },
  });
}
