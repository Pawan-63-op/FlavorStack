"use client";

import { PackageOpen, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import {
  useAcceptDelivery,
  useCompleteDelivery,
  useConfirmPickup,
  useDriverLocationPing,
  useFailDelivery,
  useRejectDelivery,
  useRiderQueue,
  useStartDelivery,
} from "@/lib/api/hooks/useDriver";
import type { DriverDeliveryAction, RiderQueueItemView } from "@/lib/api/adapters/driver";
import { DeliveryCard, type DriverActionPayload } from "./DeliveryCard";

/** Success-toast copy per action. */
const ACTION_SUCCESS: Record<DriverDeliveryAction, string> = {
  accept: "Offer accepted.",
  reject: "Offer rejected.",
  pickup: "Pickup confirmed.",
  "out-for-delivery": "Out for delivery.",
  deliver: "Delivery completed.",
  fail: "Delivery marked failed.",
};

/** First out-for-delivery item drives the background location ping. */
function activeDeliveryId(items: RiderQueueItemView[]): string | null {
  return items.find((i) => i.fulfillmentStatus === "OUT_FOR_DELIVERY")?.fulfillmentId ?? null;
}

/**
 * The driver's offered + active deliveries (Phase 14.4). Owns all lifecycle
 * mutations and dispatches them by action name; every mutation invalidates the
 * queue (see the hooks), so the list re-renders with the advanced state. While
 * a delivery is out for delivery, a background GPS ping feeds live tracking.
 */
export function DriverQueue({ isOnline }: { isOnline: boolean }) {
  const query = useRiderQueue(isOnline);
  const items = query.data ?? [];

  const accept = useAcceptDelivery();
  const reject = useRejectDelivery();
  const pickup = useConfirmPickup();
  const start = useStartDelivery();
  const complete = useCompleteDelivery();
  const fail = useFailDelivery();

  useDriverLocationPing(activeDeliveryId(items));

  // A single in-flight action across every mutation, keyed by fulfillmentId.
  const pendingId =
    (accept.isPending && accept.variables) ||
    (reject.isPending && reject.variables?.id) ||
    (pickup.isPending && pickup.variables) ||
    (start.isPending && start.variables) ||
    (complete.isPending && complete.variables?.id) ||
    (fail.isPending && fail.variables?.id) ||
    null;

  const runAction = (
    action: DriverDeliveryAction,
    id: string,
    payload?: DriverActionPayload,
  ) => {
    const handlers = {
      onSuccess: () => toast.success(ACTION_SUCCESS[action]),
      onError: (err: unknown) =>
        toast.error(err instanceof Error ? err.message : "Action failed."),
    };
    switch (action) {
      case "accept":
        return accept.mutate(id, handlers);
      case "reject":
        return reject.mutate({ id, reason: payload?.reason }, handlers);
      case "pickup":
        return pickup.mutate(id, handlers);
      case "out-for-delivery":
        return start.mutate(id, handlers);
      case "deliver":
        return complete.mutate({ id, proof: payload?.proof }, handlers);
      case "fail":
        return fail.mutate({ id, failureReason: payload?.failureReason ?? "OTHER" }, handlers);
    }
  };

  if (!isOnline) {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
          <PowerOff className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            You&apos;re offline. Go online to receive delivery offers.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (query.isLoading) {
    return <p className="text-center text-muted-foreground py-12">Loading your queue…</p>;
  }

  if (items.length === 0) {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
          <PackageOpen className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No deliveries right now. New offers will appear here automatically.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <DeliveryCard
          key={item.fulfillmentId}
          item={item}
          pending={pendingId === item.fulfillmentId}
          onAction={runAction}
        />
      ))}
    </div>
  );
}
