"use client";

import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { Skeleton } from "./ui/skeleton";
import { motion } from "motion/react";
import {
  Package, Clock, CheckCircle, XCircle, ChefHat,
  Truck, Eye, Navigation, MapPin, Star,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle,
} from "./ui/dialog";
import { useState } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { useRouter } from "next/navigation";
import { useTrackedOrders, type TrackedOrderItem } from "@/lib/api/hooks/useOrders";
import {
  getFulfillmentStatusInfo,
  getOrderRequestStatusInfo,
  type StatusColorToken,
  type StatusIconKey,
  type StatusInfo,
} from "@/lib/orders/statusMap";
import { formatDate } from "@/lib/api/format/date";
import { formatMoney } from "@/lib/api/format/money";
import { PAYMENT_METHODS } from "@/lib/api/adapters/checkout";
import { canReviewOrder } from "@/lib/api/hooks/useReviews";
import { isEnabled } from "@/lib/config/featureFlags";

const STATUS_COLOR_CLASS: Record<StatusColorToken, string> = {
  neutral: "bg-gray-500",
  info: "bg-blue-500",
  warning: "bg-yellow-500",
  success: "bg-green-500",
  danger: "bg-red-500",
};

const STATUS_ICON: Record<StatusIconKey, React.ReactNode> = {
  placed: <Clock className="h-4 w-4" />,
  preparing: <ChefHat className="h-4 w-4" />,
  ready: <Package className="h-4 w-4" />,
  pickedUp: <Package className="h-4 w-4" />,
  onTheWay: <Truck className="h-4 w-4" />,
  delivered: <CheckCircle className="h-4 w-4" />,
  cancelled: <XCircle className="h-4 w-4" />,
  failed: <XCircle className="h-4 w-4" />,
  unassigned: <Clock className="h-4 w-4" />,
  assigned: <CheckCircle className="h-4 w-4" />,
  enRoute: <Truck className="h-4 w-4" />,
  atRestaurant: <MapPin className="h-4 w-4" />,
  unknown: <Package className="h-4 w-4" />,
};

function paymentLabel(method: string): string {
  return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;
}

/** Status for a tracked order: the cached fulfillment status once known, otherwise `REQUESTED`. */
function statusInfoFor(item: TrackedOrderItem): StatusInfo {
  return item.tracked.lastKnownStatus
    ? getFulfillmentStatusInfo(item.tracked.lastKnownStatus)
    : getOrderRequestStatusInfo("REQUESTED");
}

function StatusBadge({ status }: { status: StatusInfo }) {
  return (
    <Badge className={`${STATUS_COLOR_CLASS[status.color]} border-0 text-white gap-1`}>
      {STATUS_ICON[status.icon]}
      {status.label}
    </Badge>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Card className="border-2">
      <CardContent className="pt-12 pb-12 text-center">
        <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
        <h3 className="mb-2">{title}</h3>
        <p className="text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

/** Whether to surface the post-delivery "Leave a review" entry point (G8). */
function canReviewItem(item: TrackedOrderItem): boolean {
  return isEnabled("reviews") && canReviewOrder(item.tracked);
}

function ActionButtons({
  item,
  onDetails,
  onTrack,
  onReview,
}: {
  item: TrackedOrderItem;
  onDetails: (item: TrackedOrderItem) => void;
  onTrack: (item: TrackedOrderItem) => void;
  onReview: (item: TrackedOrderItem) => void;
}) {
  const status = statusInfoFor(item);
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button variant="outline" className="gap-2" onClick={() => onDetails(item)}>
        <Eye className="h-4 w-4" /> Details
      </Button>

      {status.isActive && (
        <Button className="gap-2" onClick={() => onTrack(item)}>
          <Navigation className="h-4 w-4" /> Track Order
        </Button>
      )}

      {/* Post-delivery review entry point (G8) — DELIVERED orders only. */}
      {canReviewItem(item) && (
        <Button className="gap-2" onClick={() => onReview(item)}>
          <Star className="h-4 w-4" /> Leave a review
        </Button>
      )}
    </div>
  );
}

function OrderCard({
  item,
  delay = 0,
  onDetails,
  onTrack,
  onReview,
}: {
  item: TrackedOrderItem;
  delay?: number;
  onDetails: (item: TrackedOrderItem) => void;
  onTrack: (item: TrackedOrderItem) => void;
  onReview: (item: TrackedOrderItem) => void;
}) {
  const { tracked, order, isLoading, isError } = item;
  const status = statusInfoFor(item);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card className="border-2 shadow-md hover:shadow-lg transition-all">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h4 className="font-mono text-sm">{tracked.orderRequestId}</h4>
                <StatusBadge status={status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {tracked.restaurantName} • {formatDate(tracked.createdAt)}
              </p>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <p className="text-xl">{order?.pricing.formattedTotal ?? formatMoney(tracked.total)}</p>
            )}
          </div>

          {isError && !order && (
            <p className="text-sm text-muted-foreground mb-3">
              We couldn&apos;t refresh this order&apos;s latest details — showing what we have saved.
            </p>
          )}

          {order && (
            <div className="space-y-1.5 mb-4">
              {order.lines.map((line) => (
                <div key={line.menuItemId} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {line.quantity}x {line.name ?? "Item"}
                  </span>
                  <span>{line.formattedLineTotal}</span>
                </div>
              ))}
            </div>
          )}

          <Separator className="my-4" />
          <ActionButtons item={item} onDetails={onDetails} onTrack={onTrack} onReview={onReview} />
        </CardContent>
      </Card>
    </motion.div>
  );
}

/**
 * Client-tracked order history (Phase 7, Batch 7.2). Replaces the legacy
 * `admin_new/cartStore`-backed history: every card is rendered from a
 * re-fetch of `GET /order-requests/:id` per id stored by checkout (Batch
 * 6.3), falling back to the locally-stored summary when a fetch is still
 * loading or has failed, so one bad id never blanks the list. Review/reorder
 * are left as Phase 9 / Phase 5 seams (not wired here) per the Phase 7 plan.
 */
export function OrderHistory() {
  const router = useRouter();
  const { items } = useTrackedOrders();

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<TrackedOrderItem | null>(null);

  const latestItem = items[0];
  const pastItems = items.slice(1);

  const handleTrackOrder = (item: TrackedOrderItem) => {
    router.push(`/order-processing?orderRequestId=${encodeURIComponent(item.tracked.orderRequestId)}`);
  };

  // Post-delivery review entry point (G8) → the verified-purchase ReviewForm
  // at /feedback/[orderId] (orderId = orderRequestId).
  const handleReview = (item: TrackedOrderItem) => {
    router.push(`/feedback/${encodeURIComponent(item.tracked.orderRequestId)}`);
  };

  const openDetails = (item: TrackedOrderItem) => {
    setViewingItem(item);
    setDetailsOpen(true);
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="mb-2">My Orders</h2>
        <p className="text-muted-foreground">Track your current and past orders</p>
      </motion.div>

      <Tabs defaultValue="latest" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="latest">Latest Order</TabsTrigger>
          <TabsTrigger value="history">Order History</TabsTrigger>
        </TabsList>

        {/* ── Latest Order ── */}
        <TabsContent value="latest" className="space-y-6 mt-6">
          {latestItem ? (
            <OrderCard item={latestItem} onDetails={openDetails} onTrack={handleTrackOrder} onReview={handleReview} />
          ) : (
            <EmptyState title="No active orders" subtitle="Your recent orders will appear here" />
          )}
        </TabsContent>

        {/* ── Order History ── */}
        <TabsContent value="history" className="space-y-4 mt-6">
          {pastItems.length > 0 ? (
            pastItems.map((item, index) => (
              <OrderCard
                key={item.tracked.orderRequestId}
                item={item}
                delay={index * 0.05}
                onDetails={openDetails}
                onTrack={handleTrackOrder}
                onReview={handleReview}
              />
            ))
          ) : (
            <EmptyState title="No order history" subtitle="Your past orders will appear here" />
          )}
        </TabsContent>
      </Tabs>

      {/* ── Order Details Dialog ── */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>Order #{viewingItem?.tracked.orderRequestId}</DialogDescription>
          </DialogHeader>
          {viewingItem && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-5 pr-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={statusInfoFor(viewingItem)} />
                </div>
                <Separator />
                <div>
                  <h4 className="mb-2">Restaurant</h4>
                  <div className="flex items-center gap-2">
                    <ChefHat className="h-4 w-4 text-muted-foreground" />
                    <span>{viewingItem.tracked.restaurantName}</span>
                  </div>
                </div>

                {!viewingItem.order && (
                  <p className="text-sm text-muted-foreground">
                    {viewingItem.isLoading
                      ? "Loading full order details…"
                      : "Full order details aren't available right now — showing what we have saved."}
                  </p>
                )}

                {viewingItem.order && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="mb-2">Delivery Address</h4>
                      <div className="p-3 bg-accent rounded-lg space-y-1 text-sm">
                        {viewingItem.order.deliveryAddress.label && (
                          <p className="font-medium">{viewingItem.order.deliveryAddress.label}</p>
                        )}
                        <p className="text-muted-foreground">
                          {viewingItem.order.deliveryAddress.street}, {viewingItem.order.deliveryAddress.city},{" "}
                          {viewingItem.order.deliveryAddress.state} {viewingItem.order.deliveryAddress.pinCode}
                        </p>
                      </div>
                    </div>

                    <Separator />
                    <div>
                      <h4 className="mb-3">Order Items</h4>
                      <div className="space-y-2">
                        {viewingItem.order.lines.map((line) => (
                          <div key={line.menuItemId} className="flex justify-between items-center p-3 bg-accent rounded-lg">
                            <div>
                              <p>{line.name ?? "Item"}</p>
                              <p className="text-sm text-muted-foreground">Qty: {line.quantity}</p>
                            </div>
                            <span>{line.formattedLineTotal}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>{viewingItem.order.pricing.formattedSubtotal}</span>
                      </div>
                      {viewingItem.order.pricing.fees.map((fee) => (
                        <div key={fee.type} className="flex justify-between">
                          <span className="text-muted-foreground capitalize">{fee.type.toLowerCase()}</span>
                          <span>{fee.formattedAmount}</span>
                        </div>
                      ))}
                      {(viewingItem.order.pricing.discount.amount ?? 0) > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>Discount</span>
                          <span>-{viewingItem.order.pricing.formattedDiscount}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between font-semibold">
                        <span>Total</span>
                        <span className="text-xl">{viewingItem.order.pricing.formattedTotal}</span>
                      </div>
                    </div>

                    <Separator />
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Order Date</span>
                        <span>{formatDate(viewingItem.order.createdAt)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Payment</span>
                        <span>{paymentLabel(viewingItem.order.paymentMethod)}</span>
                      </div>
                    </div>
                  </>
                )}

                {(statusInfoFor(viewingItem).isActive || canReviewItem(viewingItem)) && (
                  <div className="flex gap-2 pt-2">
                    {statusInfoFor(viewingItem).isActive && (
                      <Button className="flex-1 gap-2"
                        onClick={() => { setDetailsOpen(false); handleTrackOrder(viewingItem); }}>
                        <Navigation className="h-4 w-4" /> Track Order
                      </Button>
                    )}
                    {canReviewItem(viewingItem) && (
                      <Button className="flex-1 gap-2"
                        onClick={() => { setDetailsOpen(false); handleReview(viewingItem); }}>
                        <Star className="h-4 w-4" /> Leave a review
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
