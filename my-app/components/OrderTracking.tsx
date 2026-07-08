"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "./ui/alert-dialog";
import {
  Package, Clock, CheckCircle, XCircle, ChefHat,
  Truck, MapPin, Loader2, User, Radio, Navigation, Star,
} from "lucide-react";
import { isOrderCancellable, useCancelOrder, useTracking } from "@/lib/api/hooks/useTracking";
import { isOrderReviewable } from "@/lib/api/hooks/useReviews";
import { isEnabled } from "@/lib/config/featureFlags";
import { useTrackingSocket, type TrackingSocketState } from "@/hooks_/useTrackingSocket";
import {
  getDeliveryStatusInfo, getFulfillmentStatusInfo,
  type StatusColorToken, type StatusIconKey, type StatusInfo,
} from "@/lib/orders/statusMap";
import { formatDate } from "@/lib/api/format/date";
import {
  trackingAdapter,
  type CancellationVM,
  type TrackingView,
} from "@/lib/api/adapters/tracking";
import type { TrackingStatusEvent } from "@/lib/realtime/trackingSocket";

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

export interface TerminalBanner {
  variant: "cancelled" | "failed";
  message: string;
}

function cancellationMessage(cancellation: CancellationVM): string {
  return `Cancelled by ${cancellation.cancelledBy}: ${cancellation.reason}`;
}

/**
 * Derives the cancellation/failure banner (if any) from a tracking view.
 * Pure so it's testable without rendering; cancellation takes precedence
 * since the two states shouldn't co-occur in practice.
 */
export function terminalBannerFor(view: TrackingView): TerminalBanner | null {
  if (view.cancellation) {
    return { variant: "cancelled", message: cancellationMessage(view.cancellation) };
  }
  if (view.failureReason) {
    return { variant: "failed", message: view.failureReason };
  }
  return null;
}

/**
 * Folds a live `tracking:status` event into a tracking view (Batch 7.4): the
 * event supersedes `currentStatus`, recomputes the derived label/terminal flag
 * via `statusMap`, and appends a timeline entry unless that exact status/`at`
 * is already present (snapshots already include past statuses). Pure/testable.
 */
export function applyStatusEvent(view: TrackingView, event: TrackingStatusEvent): TrackingView {
  const info = getFulfillmentStatusInfo(event.status);
  const alreadyPresent = view.timeline.some(
    (t) => t.status === event.status && t.at === event.at,
  );
  return {
    ...view,
    currentStatus: event.status,
    currentStatusLabel: info.label,
    isTerminal: info.isTerminal,
    timeline: alreadyPresent
      ? view.timeline
      : [...view.timeline, { status: event.status, statusLabel: info.label, at: event.at }],
    ...(event.riderId != null ? { riderId: event.riderId } : {}),
  };
}

/**
 * Picks the view to render (Batch 7.4): the live socket snapshot is authoritative
 * when present (adapted to a `TrackingView`), otherwise the Batch 7.3 HTTP query
 * is the fallback. A live `tracking:status` event is folded on top. Returns
 * `null` when neither source has data yet. Pure/testable.
 */
export function resolveTrackingView(
  httpData: TrackingView | undefined,
  socket: TrackingSocketState,
): TrackingView | null {
  const base = socket.snapshot ? trackingAdapter(socket.snapshot) : (httpData ?? null);
  if (!base) return null;
  return socket.status ? applyStatusEvent(base, socket.status) : base;
}

function StatusBadge({ status }: { status: StatusInfo }) {
  return (
    <Badge className={`${STATUS_COLOR_CLASS[status.color]} border-0 text-white gap-1`}>
      {STATUS_ICON[status.icon]}
      {status.label}
    </Badge>
  );
}

/**
 * Customer cancel action (Phase 15 / G7) — only rendered for a pre-pickup
 * fulfillment (`isOrderCancellable`). Opens a confirm dialog that requires a
 * reason (the server's `cancelSchema` mandates 1–500 chars); on confirm it
 * `POST`s `/fulfillments/:id/cancel`. The aggregate is the final authority on
 * the cancellation window, so a late cancel surfaces the server error inline.
 */
function CancelOrderButton({ fulfillmentId }: { fulfillmentId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const cancelOrder = useCancelOrder(fulfillmentId);
  const trimmed = reason.trim();

  const handleConfirm = () => {
    cancelOrder.mutate(
      { reason: trimmed },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="w-full text-destructive hover:text-destructive">
          <XCircle className="h-4 w-4" /> Cancel order
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
          <AlertDialogDescription>
            Cancellation is only possible before the rider picks up your order. Tell us why so the
            restaurant can stop preparing it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="cancel-reason">Reason</Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder="e.g. Ordered by mistake"
          />
          {cancelOrder.isError && (
            <p className="text-sm text-destructive">
              {cancelOrder.error instanceof Error
                ? cancelOrder.error.message
                : "We couldn't cancel this order."}
            </p>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={cancelOrder.isPending}>Keep order</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={!trimmed || cancelOrder.isPending}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {cancelOrder.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Cancel order"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function LoadingState() {
  return (
    <Card className="border-2">
      <CardContent className="pt-12 pb-12 text-center">
        <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

function ErrorState() {
  return (
    <Card className="border-2">
      <CardContent className="pt-12 pb-12 text-center space-y-2">
        <XCircle className="h-10 w-10 mx-auto text-destructive" />
        <h3>We couldn&apos;t load tracking for this order</h3>
        <p className="text-muted-foreground">
          The fulfillment may not exist, or you don&apos;t have access to it.
        </p>
      </CardContent>
    </Card>
  );
}

/** No `fulfillmentId` known yet — the order↔fulfillment linkage gap (Phase_7.md). */
function UnknownFulfillmentState() {
  return (
    <Card className="border-2">
      <CardContent className="pt-12 pb-12 text-center space-y-2">
        <Clock className="h-10 w-10 mx-auto text-muted-foreground" />
        <h3>Tracking isn&apos;t available yet</h3>
        <p className="text-muted-foreground">
          We&apos;ll show live tracking here as soon as the restaurant accepts your order.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Order/tracking detail screen (Phase 7, Batch 7.3) — renders
 * `GET /fulfillments/:id/tracking` via `useTracking`: current status,
 * delivery sub-status, status timeline, delivery address, and
 * cancellation/failure banners. `fulfillmentId` is nullable because the
 * order↔fulfillment linkage is only known once discovered (tracking fetch
 * or, from Batch 7.4, the socket snapshot) — this renders a placeholder
 * rather than an error while it's still unknown.
 */
export function OrderTracking({ fulfillmentId }: { fulfillmentId: string | null }) {
  const socket = useTrackingSocket(fulfillmentId);
  // When the socket is connected it's authoritative; HTTP stops polling and only
  // serves as the disconnect fallback (Batch 7.4). On `tracking:error` (not owner
  // / unknown id) we surface a friendly message rather than crashing.
  const { data: httpData, isLoading, isError } = useTracking(fulfillmentId, {
    socketConnected: socket.connected,
  });

  const data = resolveTrackingView(httpData, socket);

  if (!fulfillmentId) return <UnknownFulfillmentState />;
  if (socket.error && !data) return <ErrorState />;
  if (!data && isLoading) return <LoadingState />;
  if (!data && isError) return <ErrorState />;
  if (!data) return <LoadingState />;

  const banner = terminalBannerFor(data);
  const deliveryInfo = getDeliveryStatusInfo(data.deliveryStatus);
  const currentInfo = getFulfillmentStatusInfo(data.currentStatus);

  return (
    <Card className="border-2 shadow-md">
      <CardContent className="pt-6 space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <h3 className="mb-1">Order Tracking</h3>
            <p className="text-sm text-muted-foreground font-mono">{data.orderRequestId}</p>
          </div>
          <div className="flex items-center gap-2">
            {socket.connected && (
              <Badge className="bg-emerald-500 border-0 text-white gap-1">
                <Radio className="h-3 w-3" />
                Live
              </Badge>
            )}
            <StatusBadge status={currentInfo} />
          </div>
        </div>

        {banner && (
          <div className="p-3 rounded-lg text-sm bg-red-500/10 text-red-600">{banner.message}</div>
        )}

        {socket.error && (
          <div className="p-3 rounded-lg text-sm bg-yellow-500/10 text-yellow-700">
            Live updates are unavailable ({socket.error}); showing the latest known status.
          </div>
        )}

        {!data.isTerminal && (
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Rider</span>
            <StatusBadge status={deliveryInfo} />
          </div>
        )}

        {socket.latestLocation && (
          <div className="flex items-start gap-2 text-sm">
            <Navigation className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p>Rider location</p>
              <p className="text-muted-foreground font-mono">
                {socket.latestLocation.lat.toFixed(5)}, {socket.latestLocation.lng.toFixed(5)}
              </p>
              <p className="text-muted-foreground">
                Updated {formatDate(socket.latestLocation.recordedAt)}
              </p>
            </div>
          </div>
        )}

        <Separator />

        <div>
          <h4 className="mb-3">Status Timeline</h4>
          <div className="space-y-3">
            {data.timeline.length === 0 && (
              <p className="text-sm text-muted-foreground">No status updates yet.</p>
            )}
            {data.timeline.map((entry, i) => (
              <div key={`${entry.status}-${entry.at}-${i}`} className="flex items-start gap-3 text-sm">
                <div className="mt-0.5">{STATUS_ICON[getFulfillmentStatusInfo(entry.status).icon]}</div>
                <div className="flex-1">
                  <p>{entry.statusLabel}</p>
                  <p className="text-muted-foreground">{formatDate(entry.at)}</p>
                  {entry.note && <p className="text-muted-foreground">{entry.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div className="space-y-1 text-sm">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-muted-foreground">
              {data.deliveryAddress.street}, {data.deliveryAddress.city}, {data.deliveryAddress.state}{" "}
              {data.deliveryAddress.pinCode}
            </p>
          </div>
          <div className="flex justify-between pt-2">
            <span className="text-muted-foreground">Total</span>
            <span>{data.formattedTotal}</span>
          </div>
        </div>

        {isOrderCancellable(data.currentStatus) && (
          <>
            <Separator />
            <CancelOrderButton fulfillmentId={data.fulfillmentId} />
          </>
        )}

        {/* Post-delivery review entry point (G8) — only once DELIVERED. The
            verified-purchase ReviewForm at /feedback/[orderId] does the final
            eligibility + already-reviewed gating. */}
        {isEnabled("reviews") && isOrderReviewable(data.fulfillmentId, data.currentStatus) && (
          <>
            <Separator />
            <Button asChild className="w-full gap-2">
              <Link href={`/feedback/${encodeURIComponent(data.orderRequestId)}`}>
                <Star className="h-4 w-4" /> Leave a review
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
