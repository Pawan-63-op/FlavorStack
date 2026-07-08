"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { OrderConfirmation } from "../OrderConfirmation";
import { OrderTracking } from "../OrderTracking";
import { getTrackedOrder, getTrackedOrders } from "@/lib/orders/trackedOrders";
import { useResolveFulfillmentId } from "@/lib/api/hooks/useMyOrders";
import { isEnabled } from "@/lib/config/featureFlags";

/**
 * Order confirmation entry (Batch 6.4) + tracking handoff (Batch 7.3). Reads
 * the `orderRequestId` handed over by checkout (Batch 6.3) from the query
 * string, falling back to the most recent client-tracked order on a bare
 * visit. Once a `fulfillmentId` is cached for that order (discovered from a
 * tracking fetch — the order↔fulfillment linkage gap, Phase_7.md), this
 * switches from the static confirmation to the live tracking screen;
 * otherwise it keeps the Phase 6 static `REQUESTED` confirmation.
 *
 * Batch 8.2: a notification deep-link (Phase 8) arrives with a `fulfillmentId`
 * query param (parsed best-effort from the notification body) rather than an
 * `orderRequestId`, so this also tracks directly by fulfillment when given one.
 *
 * Phase 15 / G1: when the order↔fulfillment linkage isn't cached locally, it's
 * now resolved from server truth (`GET /me/orders` via `useResolveFulfillmentId`)
 * so the customer sees live tracking instead of being stuck on the static
 * confirmation — closing the linkage gap.
 */
export function OrderProcessingWrapper() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const fulfillmentIdParam = searchParams.get("fulfillmentId");
  const orderRequestId =
    searchParams.get("orderRequestId") ?? getTrackedOrders()[0]?.orderRequestId ?? null;
  const trackingEnabled = isEnabled("tracking");

  // Locally-cached linkage (from a prior tracking fetch/socket); may be absent.
  const cachedFulfillmentId =
    (orderRequestId && getTrackedOrder(orderRequestId)?.fulfillmentId) || null;

  // Resolve from server truth only when tracking is on, we have an order id, and
  // it isn't already cached locally. The hook is always called (rules of hooks);
  // a `null` arg short-circuits the fetch.
  const { fulfillmentId: resolvedFulfillmentId } = useResolveFulfillmentId(
    trackingEnabled && orderRequestId && !cachedFulfillmentId ? orderRequestId : null,
  );

  useEffect(() => {
    if (!orderRequestId && !fulfillmentIdParam) router.replace("/orders");
  }, [orderRequestId, fulfillmentIdParam, router]);

  // Deep-linked straight to a fulfillment (e.g. from a Phase 8 notification).
  if (trackingEnabled && fulfillmentIdParam) {
    return <OrderTracking fulfillmentId={fulfillmentIdParam} />;
  }

  if (!orderRequestId) return null;

  const fulfillmentId = cachedFulfillmentId ?? resolvedFulfillmentId;

  if (trackingEnabled && fulfillmentId) {
    return <OrderTracking fulfillmentId={fulfillmentId} />;
  }

  return <OrderConfirmation orderRequestId={orderRequestId} />;
}
