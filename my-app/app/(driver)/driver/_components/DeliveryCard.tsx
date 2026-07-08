"use client";

import { useState } from "react";
import { Clock, Loader2, MapPin, Store } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DRIVER_FAILURE_REASONS,
  type DriverDeliveryAction,
  type RiderQueueItemView,
} from "@/lib/api/adapters/driver";

/** Payload a card may attach to an action (reject reason / deliver proof / failure reason). */
export interface DriverActionPayload {
  reason?: string;
  proof?: string;
  failureReason?: string;
}

/** Primary-button copy per action, in the order `driverActionsForItem` emits them. */
const ACTION_LABEL: Record<DriverDeliveryAction, string> = {
  accept: "Accept",
  reject: "Reject",
  pickup: "Confirm pickup",
  "out-for-delivery": "Start delivery",
  deliver: "Mark delivered",
  fail: "Report failure",
};

/**
 * One offered/active delivery (Phase 14.4). Renders the restaurant + delivery
 * address, the current fulfillment status, and the actions the item allows
 * (pre-derived in `riderQueueItemAdapter`). The failure path needs a reason, so
 * a `fail` action reveals an inline reason picker before the request is sent.
 */
export function DeliveryCard({
  item,
  pending,
  onAction,
}: {
  item: RiderQueueItemView;
  pending: boolean;
  onAction: (action: DriverDeliveryAction, id: string, payload?: DriverActionPayload) => void;
}) {
  const [failureReason, setFailureReason] = useState<string>(DRIVER_FAILURE_REASONS[0].value);

  return (
    <Card className="border-2">
      <CardContent className="pt-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">{item.fulfillmentId}</span>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{item.fulfillmentStatusLabel}</Badge>
            {item.assignmentStatus === "OFFERED" && (
              <Badge variant="outline">Offered</Badge>
            )}
          </div>
        </div>

        <div className="text-sm text-muted-foreground space-y-1">
          <span className="flex items-center gap-2">
            <Store className="h-3.5 w-3.5" />
            Restaurant {item.restaurantId}
          </span>
          <span className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5" />
            {item.formattedAddress}
          </span>
          <span className="flex items-center gap-4">
            <span>{item.formattedTotal}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {item.formattedOfferedAge}
            </span>
          </span>
        </div>

        {item.actions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {item.actions.includes("fail") && (
              <Select value={failureReason} onValueChange={setFailureReason}>
                <SelectTrigger className="w-48" aria-label="Failure reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DRIVER_FAILURE_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {item.actions.map((action) => (
              <Button
                key={action}
                size="sm"
                variant={action === "reject" || action === "fail" ? "outline" : "default"}
                disabled={pending}
                onClick={() =>
                  onAction(action, item.fulfillmentId, action === "fail" ? { failureReason } : undefined)
                }
              >
                {pending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                {ACTION_LABEL[action]}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
