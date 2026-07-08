"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CartViewModel, ValidatePromotionResponseDto } from "../adapters/cart";
import { queryKeys } from "../queryKeys";
import { cartService } from "../services/cart";

/**
 * Promotion hooks (Batch 5.3) — apply/validate/remove a promotion code against
 * the server cart. Apply/remove re-mirror the returned cart into `['cart']`
 * (same pattern as `useCart.ts`'s `useCartCacheSync`). Validate is a dry-run
 * preview — the server never persists it, so it writes nothing to the cache;
 * callers read the mutation's resolved value directly.
 *
 * Errors are surfaced via `mutateAsync`/`error` rather than toasted here, so
 * the cart page can render them as inline field messages (ineligible,
 * min-order-not-met, expired, unknown code) instead of a generic toast.
 */
function useCartCacheSync(): (cart: CartViewModel) => void {
  const queryClient = useQueryClient();
  return (cart) => {
    queryClient.setQueryData(queryKeys.cart.current(), cart);
    void queryClient.invalidateQueries({ queryKey: queryKeys.cart.summary() });
  };
}

export function useApplyPromotion() {
  const sync = useCartCacheSync();
  return useMutation({
    mutationFn: (code: string) => cartService.applyPromotion(code),
    onSuccess: sync,
  });
}

export function useValidatePromotion() {
  return useMutation({
    mutationFn: (code: string): Promise<ValidatePromotionResponseDto> =>
      cartService.validatePromotion(code),
  });
}

export function useRemovePromotion() {
  const sync = useCartCacheSync();
  return useMutation({
    mutationFn: () => cartService.removePromotion(),
    onSuccess: (cart) => {
      sync(cart);
      toast.success("Promotion removed");
    },
  });
}
