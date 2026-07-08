"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthStore } from "../../../store/authStore";
import { ApiError } from "../errors/ApiError";
import { queryKeys } from "../queryKeys";
import type { CartViewModel } from "../adapters/cart";
import { cartService, type AddCartItemInput } from "../services/cart";

/**
 * Cart query + mutation hooks — thin TanStack wrappers over `cartService`
 * (Batch 5.2). The server cart is the single source of truth: every mutation
 * returns the full updated cart, which we write straight into the `['cart']`
 * cache (`setQueryData`) and use to invalidate the lightweight
 * `['cart','summary']` badge query — no client-side total math.
 *
 * All `/cart` endpoints are auth-only, so the read queries are gated on the
 * authenticated session. Guest staging + login replay is Batch 5.4; until then
 * an unauthenticated visitor simply has no cart query in flight.
 */

/** Toast an `ApiError`'s server message, with a generic fallback. */
function toastError(error: unknown, fallback: string): void {
  toast.error(error instanceof ApiError ? error.message : fallback);
}

export function useCart() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: queryKeys.cart.current(),
    queryFn: () => cartService.getCart(),
    enabled: isAuthenticated,
  });
}

export function useCartSummary() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: queryKeys.cart.summary(),
    queryFn: () => cartService.getSummary(),
    enabled: isAuthenticated,
  });
}

/**
 * Shared success handler: the mutation's returned cart is authoritative, so we
 * seed it into the cache and invalidate the derived summary badge.
 */
function useCartCacheSync(): (cart: CartViewModel) => void {
  const queryClient = useQueryClient();
  return (cart) => {
    queryClient.setQueryData(queryKeys.cart.current(), cart);
    void queryClient.invalidateQueries({ queryKey: queryKeys.cart.summary() });
  };
}

/**
 * Add a line. Errors (incl. the single-restaurant `conflict`) are surfaced to
 * the caller via `mutateAsync` rather than toasted here, so the cart page /
 * menu can run the "start a new cart?" recovery flow before showing anything.
 */
export function useAddToCart() {
  const sync = useCartCacheSync();
  return useMutation({
    mutationFn: (input: AddCartItemInput) => cartService.addItem(input),
    onSuccess: sync,
  });
}

export function useUpdateCartItem() {
  const sync = useCartCacheSync();
  return useMutation({
    mutationFn: ({ cartItemId, quantity }: { cartItemId: string; quantity: number }) =>
      cartService.updateItem(cartItemId, quantity),
    onSuccess: sync,
    onError: (error) => toastError(error, "Could not update the cart"),
  });
}

export function useRemoveCartItem() {
  const sync = useCartCacheSync();
  return useMutation({
    mutationFn: (cartItemId: string) => cartService.removeItem(cartItemId),
    onSuccess: (cart) => {
      sync(cart);
      toast.success("Item removed from cart");
    },
    onError: (error) => toastError(error, "Could not remove the item"),
  });
}

export function useClearCart() {
  const sync = useCartCacheSync();
  return useMutation({
    mutationFn: () => cartService.clearCart(),
    onSuccess: sync,
    onError: (error) => toastError(error, "Could not clear the cart"),
  });
}
