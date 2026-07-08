"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Clock, PackageCheck, ShieldAlert } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { isEnabled } from "@/lib/config/featureFlags";
import { queryKeys } from "@/lib/api/queryKeys";
import { checkoutService } from "@/lib/api/services/checkout";
import { useTracking } from "@/lib/api/hooks/useTracking";
import { useMyOrders } from "@/lib/api/hooks/useMyOrders";
import { canReviewOrder, useMyReviews } from "@/lib/api/hooks/useReviews";
import { getTrackedOrder, type TrackedOrder } from "@/lib/orders/trackedOrders";
import { getFulfillmentStatusInfo } from "@/lib/orders/statusMap";

/**
 * Review submission page (Phase 9, Batch 9.2). The route param `orderId` is the
 * Phase 7 `orderRequestId`. This container resolves the verified-purchase
 * context the dual-rating `ReviewForm` needs:
 *
 *  - `restaurantId` via `GET /order-requests/:id` (the review POST is path-scoped
 *    to the restaurant, and the server cross-checks it against the fulfillment).
 *  - `fulfillmentId` + delivery status from the server `GET /me/orders` row
 *    (Phase 15 / G14 — folds into G1), so review works on a fresh browser /
 *    without first opening tracking; the Phase 7 `trackedOrders` cache is the
 *    fallback, and a tracking fetch refreshes the live status when known.
 *
 * It then gates the form via `canReviewOrder` (delivered + known fulfillment),
 * surfaces already-reviewed (from `/me/reviews`) and not-yet-deliverable states,
 * and is hidden entirely when the `reviews` flag is off.
 */

function StateCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="w-full max-w-2xl mx-auto border-2 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}

export function FeedbackPage() {
  const params = useParams();
  const orderRequestId = (params.orderId as string) ?? "";
  const reviewsEnabled = isEnabled("reviews");

  // restaurantId + ownership come from the order-request detail (Phase 7 source).
  const orderQuery = useQuery({
    queryKey: queryKeys.orderRequests.detail(orderRequestId),
    queryFn: () => checkoutService.getOrderRequest(orderRequestId),
    enabled: reviewsEnabled && Boolean(orderRequestId),
  });

  // Server-truth linkage (G14): resolve fulfillmentId + current status from the
  // customer's /me/orders row so review works without first opening tracking and
  // survives a cleared cache; the localStorage trackedOrders entry is a fallback.
  const { data: myOrders } = useMyOrders({
    enabled: reviewsEnabled && Boolean(orderRequestId),
  });
  const serverOrder = orderRequestId
    ? myOrders?.find((o) => o.orderRequestId === orderRequestId)
    : undefined;

  const tracked: TrackedOrder | undefined = orderRequestId
    ? getTrackedOrder(orderRequestId)
    : undefined;
  const fulfillmentId = serverOrder?.fulfillmentId ?? tracked?.fulfillmentId ?? null;

  // A known fulfillmentId lets us refresh delivery status; useTracking also
  // writes the latest status back into trackedOrders (Phase 7 linkage).
  const trackingQuery = useTracking(reviewsEnabled ? fulfillmentId : null);
  const lastKnownStatus =
    trackingQuery.data?.currentStatus ?? serverOrder?.fulfillmentStatus ?? tracked?.lastKnownStatus;

  const eligible =
    fulfillmentId !== null &&
    canReviewOrder({
      orderRequestId,
      restaurantName: tracked?.restaurantName ?? "",
      total: tracked?.total ?? null,
      createdAt: tracked?.createdAt ?? "",
      idempotencyKey: tracked?.idempotencyKey ?? "",
      fulfillmentId,
      lastKnownStatus,
    });

  // Surface already-reviewed proactively from the user's own reviews.
  const myReviews = useMyReviews();
  const myReviewItems = myReviews.data?.pages.flatMap((page) => page.items) ?? [];
  const alreadyReviewed =
    fulfillmentId !== null &&
    myReviewItems.some((review) => review.fulfillmentId === fulfillmentId);

  if (!reviewsEnabled) {
    return (
      <StateCard
        icon={<ShieldAlert className="h-6 w-6 text-muted-foreground" />}
        title="Reviews are unavailable"
        description="Customer reviews aren't enabled right now."
      />
    );
  }

  if (!orderRequestId) {
    return (
      <StateCard
        icon={<ShieldAlert className="h-6 w-6 text-muted-foreground" />}
        title="No order specified"
        description="We couldn't tell which order you'd like to review."
      />
    );
  }

  if (orderQuery.isLoading) {
    return <p className="text-center mt-10 text-muted-foreground">Loading…</p>;
  }

  if (orderQuery.isError || !orderQuery.data) {
    return (
      <StateCard
        icon={<ShieldAlert className="h-6 w-6 text-muted-foreground" />}
        title="Order not found"
        description="We couldn't load this order. Please try again from your order history."
      />
    );
  }

  if (alreadyReviewed) {
    return (
      <StateCard
        icon={<PackageCheck className="h-6 w-6 text-green-600" />}
        title="You've already reviewed this order"
        description="Find it under My reviews, where you can see its moderation status."
      />
    );
  }

  if (!fulfillmentId) {
    return (
      <StateCard
        icon={<ShieldAlert className="h-6 w-6 text-muted-foreground" />}
        title="We can't verify this order yet"
        description="We couldn't link this order to a delivery yet. Please try again once the restaurant has accepted it."
      />
    );
  }

  if (!eligible) {
    const statusLabel = lastKnownStatus
      ? getFulfillmentStatusInfo(lastKnownStatus).label
      : "in progress";
    return (
      <StateCard
        icon={<Clock className="h-6 w-6 text-muted-foreground" />}
        title="Reviews open after delivery"
        description={`This order is ${statusLabel.toLowerCase()}. You'll be able to review it once it's delivered.`}
      />
    );
  }

  return <ReviewForm restaurantId={orderQuery.data.restaurantId} fulfillmentId={fulfillmentId} />;
}
