"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, Loader2, MapPin, Navigation, Package, XCircle } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { queryKeys } from "@/lib/api/queryKeys";
import { checkoutService } from "@/lib/api/services/checkout";
import { PAYMENT_METHODS, type FeeType } from "@/lib/api/adapters/checkout";
import { formatDate } from "@/lib/api/format/date";
import { isEnabled } from "@/lib/config/featureFlags";

const FEE_LABEL: Record<FeeType, string> = {
  PLATFORM: "Platform fee",
  PACKAGING: "Packaging",
  DELIVERY: "Delivery fee",
};

function paymentLabel(method: string): string {
  return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="w-full max-w-2xl mx-auto p-4">{children}</div>;
}

/**
 * Static order confirmation (Batch 6.4) rendered from `OrderRequestSummaryResponse`.
 * The order is usually already in the `orderRequests.detail` cache (seeded by the
 * place-order mutation in Batch 6.3); this query falls back to `GET /order-requests/:id`
 * on a cold load / refresh. Phase 6 ends at `REQUESTED`; live fulfillment tracking (Phase 7)
 * is linked from here behind the `tracking` flag.
 */
export function OrderConfirmation({ orderRequestId }: { orderRequestId: string }) {
  const router = useRouter();
  const { data: order, isLoading, isError } = useQuery({
    queryKey: queryKeys.orderRequests.detail(orderRequestId),
    queryFn: () => checkoutService.getOrderRequest(orderRequestId),
  });

  if (isLoading) {
    return (
      <Shell>
        <Card className="border-2">
          <CardContent className="pt-12 pb-12 text-center">
            <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (isError || !order) {
    return (
      <Shell>
        <Card className="border-2">
          <CardContent className="pt-12 pb-12 text-center space-y-4">
            <XCircle className="h-10 w-10 mx-auto text-destructive" />
            <h3>We couldn&apos;t load this order</h3>
            <p className="text-muted-foreground">
              The order may not exist, or you don&apos;t have access to it.
            </p>
            <Button onClick={() => router.push("/orders")}>View all orders</Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const { pricing, deliveryAddress } = order;

  return (
    <Shell>
      <Card className="border-2 shadow-2xl overflow-hidden">
        <CardContent className="pt-10 pb-10 space-y-8">
          {/* ── Success header ── */}
          <div className="text-center space-y-3">
            <div className="h-20 w-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold">Order Placed Successfully!</h2>
            <p className="text-muted-foreground font-mono text-sm">{order.orderRequestId}</p>
            <div className="flex items-center justify-center gap-2">
              <Badge variant="secondary" className="text-base px-4 py-1">
                {pricing.formattedTotal}
              </Badge>
              <Badge variant="outline">{order.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              from {order.restaurantName} · {formatDate(order.createdAt)}
            </p>
          </div>

          {/* ── Items ── */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Items</p>
            {order.lines.map((line) => (
              <div key={line.menuItemId} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {line.quantity}x {line.name ?? "Item"}
                </span>
                <span>{line.formattedLineTotal}</span>
              </div>
            ))}
          </div>

          <Separator />

          {/* ── Pricing breakdown ── */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{pricing.formattedSubtotal}</span>
            </div>
            {pricing.fees.map((fee) => (
              <div key={fee.type} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{FEE_LABEL[fee.type] ?? fee.type}</span>
                <span>{fee.formattedAmount}</span>
              </div>
            ))}
            {(pricing.discount.amount ?? 0) > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
                <span>-{pricing.formattedDiscount}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span>{pricing.formattedTax}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold">{pricing.formattedTotal}</span>
            </div>
          </div>

          <Separator />

          {/* ── Delivery + payment ── */}
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-sm">
                {deliveryAddress.label && (
                  <p className="font-medium">{deliveryAddress.label}</p>
                )}
                <p className="text-muted-foreground">
                  {deliveryAddress.street}, {deliveryAddress.city}, {deliveryAddress.state}{" "}
                  {deliveryAddress.pinCode}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Payment</span>
              <span>{paymentLabel(order.paymentMethod)}</span>
            </div>
          </div>

          {/* ── Tracking (Phase 7, flag-gated) ──
              This was a "coming soon" placeholder long after tracking actually shipped: the
              `/order-processing` page was reachable from a notification deep-link but from
              nowhere in the post-checkout flow, which is exactly when a customer wants it.
              Same route and query param `OrderHistory` uses for its Track action. */}
          {isEnabled("tracking") && (
            <Button
              className="w-full gap-2"
              onClick={() =>
                router.push(
                  `/order-processing?orderRequestId=${encodeURIComponent(orderRequestId)}`,
                )
              }
            >
              <Navigation className="h-4 w-4" />
              Track this order
            </Button>
          )}

          {/* ── Actions ── */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => router.push("/orders")}>
              View All Orders
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => router.push("/restaurants")}>
              Order More
            </Button>
          </div>
        </CardContent>
      </Card>
    </Shell>
  );
}
