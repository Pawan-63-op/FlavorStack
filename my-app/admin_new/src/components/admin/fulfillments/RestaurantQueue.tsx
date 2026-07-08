"use client";
import { useState } from "react";
import { ClipboardList, Clock, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOwnerRestaurants } from "@/lib/api/hooks/useOwnerCatalog";
import { useRestaurantFulfillments } from "@/lib/api/hooks/useFulfillmentAdmin";
import { useMarkPreparing, useMarkReady } from "@/lib/api/hooks/useFulfillmentOwner";
import {
  FULFILLMENT_STATUS_FILTERS,
  statusFilterToParam,
  type FulfillmentStatusFilter,
} from "./FulfillmentDashboard";

/**
 * The mutually-exclusive states the queue body can be in. Pure-resolved from
 * ownership + selection + query state so the branching is unit-testable
 * without rendering (the repo's component tests cover pure helpers only).
 */
export type QueueViewState =
  | "no-restaurants"
  | "no-selection"
  | "loading"
  | "empty"
  | "list";

export interface QueueViewInputs {
  ownedCount: number;
  restaurantId: string;
  isLoading: boolean;
  resultCount: number;
}

/** Decide which queue body to show. Order matters: ownership → selection → loading → results. */
export function resolveQueueView({
  ownedCount,
  restaurantId,
  isLoading,
  resultCount,
}: QueueViewInputs): QueueViewState {
  if (ownedCount === 0) return "no-restaurants";
  if (!restaurantId) return "no-selection";
  if (isLoading) return "loading";
  return resultCount > 0 ? "list" : "empty";
}

/** Owner prep-progress actions available for an order (Phase 14.2). */
export type OwnerQueueAction = "preparing" | "ready";

/**
 * Which prep-progress actions the owner may take from the current
 * `fulfillmentStatus`, mirroring the verified server state machine:
 * CREATED → Mark Preparing, PREPARING → Mark Ready. Everything else (already
 * READY_FOR_PICKUP, out-for-delivery, terminal) offers nothing. Pure so it is
 * unit-testable without rendering.
 */
export function ownerActionsForStatus(status: string): OwnerQueueAction[] {
  if (status === "CREATED") return ["preparing"];
  if (status === "PREPARING") return ["ready"];
  return [];
}

/**
 * Read-only restaurant prep queue (Phase 11, Batch 11.3).
 *
 * The restaurant picker is sourced from the Phase 10.2 `ownerCatalog` registry
 * (`useOwnerRestaurants` — the signed-in user's own restaurants only). This is
 * a **UX mitigation** for the unchecked-ownership backend gap on
 * `GET /restaurants/:id/fulfillments`, not a security control. No
 * reassign/cancel actions here — out of scope per ROADMAP's read-only queue.
 */
export function RestaurantQueue() {
  const { data: restaurants } = useOwnerRestaurants();
  const ownedRestaurants = restaurants ?? [];

  const [restaurantId, setRestaurantId] = useState("");
  const [statusFilter, setStatusFilter] = useState<FulfillmentStatusFilter>("ALL");

  const query = useRestaurantFulfillments(restaurantId, statusFilterToParam(statusFilter));
  const fulfillments = query.data ?? [];

  // Phase 14.2 — owner prep-progress actions, scoped to the selected restaurant.
  const markPreparing = useMarkPreparing(restaurantId);
  const markReady = useMarkReady(restaurantId);

  const advance = (action: OwnerQueueAction, id: string) => {
    const mutation = action === "preparing" ? markPreparing : markReady;
    const verb = action === "preparing" ? "preparing" : "ready";
    mutation.mutate(
      { id },
      {
        onSuccess: () => toast.success(`Order marked ${verb}.`),
        onError: (err: unknown) =>
          toast.error(err instanceof Error ? err.message : `Could not mark order ${verb}.`),
      },
    );
  };

  // A single in-flight action across either mutation, keyed by fulfillmentId.
  const pendingId =
    (markPreparing.isPending && markPreparing.variables?.id) ||
    (markReady.isPending && markReady.variables?.id) ||
    null;

  const view = resolveQueueView({
    ownedCount: ownedRestaurants.length,
    restaurantId,
    isLoading: query.isLoading,
    resultCount: fulfillments.length,
  });

  if (view === "no-restaurants") {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
          <ClipboardList className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            You don&apos;t own any restaurants yet. Create one under the Restaurants tab to see its
            prep queue.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Restaurant</Label>
          <Select value={restaurantId} onValueChange={setRestaurantId}>
            <SelectTrigger className="w-64" aria-label="Restaurant queue picker">
              <SelectValue placeholder="Select a restaurant" />
            </SelectTrigger>
            <SelectContent>
              {ownedRestaurants.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as FulfillmentStatusFilter)}
          >
            <SelectTrigger className="w-48" aria-label="Queue status filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FULFILLMENT_STATUS_FILTERS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "ALL" ? "All statuses" : s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {view === "no-selection" ? (
        <Card className="border-2 border-dashed">
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Select a restaurant to view its prep queue.
          </CardContent>
        </Card>
      ) : view === "loading" ? (
        <p className="text-center text-muted-foreground py-12">Loading…</p>
      ) : view === "list" ? (
        <div className="space-y-3">
          {fulfillments.map((item) => {
            const actions = ownerActionsForStatus(item.status);
            const isAdvancing = pendingId === item.fulfillmentId;
            return (
              <Card key={item.fulfillmentId} className="border-2">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{item.fulfillmentId}</span>
                        <Badge variant="secondary">{item.statusLabel}</Badge>
                        <Badge variant="outline">{item.deliveryStatusLabel}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span>{item.formattedTotal}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {item.statusLabel}
                        </span>
                      </div>
                    </div>

                    {actions.length > 0 && (
                      <div className="flex items-center gap-2">
                        {actions.includes("preparing") && (
                          <Button
                            size="sm"
                            disabled={isAdvancing}
                            onClick={() => advance("preparing", item.fulfillmentId)}
                          >
                            {isAdvancing && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                            Mark Preparing
                          </Button>
                        )}
                        {actions.includes("ready") && (
                          <Button
                            size="sm"
                            disabled={isAdvancing}
                            onClick={() => advance("ready", item.fulfillmentId)}
                          >
                            {isAdvancing && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                            Mark Ready
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* G18 — what to prepare: line items + where it's going. */}
                  {item.lines.length > 0 && (
                    <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Items to prepare
                      </p>
                      <ul className="space-y-1 text-sm">
                        {item.lines.map((line) => (
                          <li
                            key={line.menuItemId}
                            className="flex items-baseline justify-between gap-3"
                          >
                            <span>
                              <span className="font-medium">{line.quantity}×</span> {line.name}
                              {line.selectedOptions.length > 0 && (
                                <span className="text-muted-foreground">
                                  {" "}
                                  ({line.selectedOptions.map((o) => o.label).join(", ")})
                                </span>
                              )}
                            </span>
                            <span className="text-muted-foreground tabular-nums">
                              {line.formattedLineTotal}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {item.formattedAddress && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>
                        {item.deliveryAddress?.label && (
                          <span className="font-medium text-foreground">
                            {item.deliveryAddress.label}:{" "}
                          </span>
                        )}
                        {item.formattedAddress}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-2 border-dashed">
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
            <ClipboardList className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No fulfillments in this queue.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
