"use client";
import { useState, type FormEvent } from "react";
import { PackageSearch, AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminFulfillments } from "@/lib/api/hooks/useFulfillmentAdmin";
import type { AdminDashboardItemView } from "@/lib/api/adapters/fulfillmentAdmin";
import {
  FulfillmentActionDialog,
  type FulfillmentActionMode,
} from "./FulfillmentActionDialog";

/**
 * Status filter for the admin dashboard. `ALL` (default) sends no `status`
 * param — the server returns every fulfillment. The rest mirror the verified
 * `fulfillment-status.enum.ts`.
 */
export const FULFILLMENT_STATUS_FILTERS = [
  "ALL",
  "CREATED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "FAILED",
] as const;

export type FulfillmentStatusFilter = (typeof FULFILLMENT_STATUS_FILTERS)[number];

/** Maps the `ALL` sentinel to `undefined` (no `status` query param), else passes the status through. */
export function statusFilterToParam(filter: FulfillmentStatusFilter): string | undefined {
  return filter === "ALL" ? undefined : filter;
}

interface DialogState {
  mode: FulfillmentActionMode;
  fulfillmentId: string;
}

export function FulfillmentDashboard() {
  const [statusFilter, setStatusFilter] = useState<FulfillmentStatusFilter>("ALL");
  const [slaOnly, setSlaOnly] = useState(false);
  const [restaurantIdInput, setRestaurantIdInput] = useState("");
  const [restaurantId, setRestaurantId] = useState("");
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const query = useAdminFulfillments({
    status: statusFilterToParam(statusFilter),
    ...(slaOnly ? { slaBreached: true } : {}),
    ...(restaurantId ? { restaurantId } : {}),
  });

  const fulfillments = query.data?.pages.flatMap((page) => page.items) ?? [];

  const applyRestaurantFilter = (e: FormEvent) => {
    e.preventDefault();
    setRestaurantId(restaurantIdInput.trim());
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FulfillmentStatusFilter)}>
            <SelectTrigger className="w-48" aria-label="Fulfillment status filter">
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

        <div className="flex items-center gap-2 pb-2">
          <Switch id="sla-only" checked={slaOnly} onCheckedChange={setSlaOnly} />
          <Label htmlFor="sla-only" className="text-sm">
            SLA breached only
          </Label>
        </div>

        <form onSubmit={applyRestaurantFilter} className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="restaurant-filter" className="text-xs text-muted-foreground">
              Restaurant ID
            </Label>
            <Input
              id="restaurant-filter"
              className="w-56"
              placeholder="Filter by restaurant"
              value={restaurantIdInput}
              onChange={(e) => setRestaurantIdInput(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline">
            Apply
          </Button>
        </form>
      </div>

      {query.isLoading ? (
        <p className="text-center text-muted-foreground py-12">Loading…</p>
      ) : fulfillments.length > 0 ? (
        <div className="space-y-3">
          {fulfillments.map((item) => (
            <FulfillmentRow
              key={item.fulfillmentId}
              item={item}
              onReassign={() => setDialog({ mode: "reassign", fulfillmentId: item.fulfillmentId })}
              onCancel={() => setDialog({ mode: "cancel", fulfillmentId: item.fulfillmentId })}
            />
          ))}

          {query.hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
              >
                {query.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Card className="border-2 border-dashed">
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
            <PackageSearch className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No fulfillments match these filters.</p>
          </CardContent>
        </Card>
      )}

      {dialog && (
        <FulfillmentActionDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          mode={dialog.mode}
          fulfillmentId={dialog.fulfillmentId}
        />
      )}
    </div>
  );
}

interface FulfillmentRowProps {
  item: AdminDashboardItemView;
  onReassign: () => void;
  onCancel: () => void;
}

function FulfillmentRow({ item, onReassign, onCancel }: FulfillmentRowProps) {
  return (
    <Card className="border-2">
      <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{item.fulfillmentId}</span>
            <Badge variant="secondary">{item.statusLabel}</Badge>
            <Badge variant="outline">{item.deliveryStatusLabel}</Badge>
            {item.slaBreached && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                SLA breached
              </Badge>
            )}
            {item.exceptionFlag && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Exception
              </Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>Restaurant {item.restaurantId}</span>
            <span>{item.formattedTotal}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {item.formattedAge}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={!item.isReassignable} onClick={onReassign}>
            Reassign
          </Button>
          <Button size="sm" variant="destructive" disabled={!item.isCancellable} onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
