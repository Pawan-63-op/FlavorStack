"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../../store/authStore";
import { addTrackedOrder } from "../../orders/trackedOrders";
import { queryKeys } from "../queryKeys";
import {
  checkoutService,
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
 * Live pricing preview for the chosen saved address. Re-runs when the selection
 * changes (the key is the address id); disabled until an address is selected, so
 * there is no preview request without one. The server resolves the address, so the
 * previewed delivery fee is the one `usePlaceOrder` will be charged.
 */
export function usePreviewCheckout(addressId: string | null) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: queryKeys.checkout.preview(addressId ?? ""),
    queryFn: () => checkoutService.preview(addressId as string),
    enabled: isAuthenticated && addressId !== null,
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
