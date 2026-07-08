"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useSetItemAvailability } from "@/lib/api/hooks/useOwnerCatalog";
import type { AvailabilityInput } from "@/lib/api";
import { menuItemErrorMessage } from "./MenuItemForm";

/**
 * Builds the `PATCH /catalog/items/:id/availability` body. An out-of-stock
 * reason only makes sense while unavailable, so it's dropped when toggling
 * back on (Phase-10.md Batch 10.0 §2 — `toggleAvailability` shape).
 */
export function buildAvailabilityInput(isAvailable: boolean, reason: string): AvailabilityInput {
  if (isAvailable) return { isAvailable: true };
  const trimmed = reason.trim();
  return trimmed.length > 0
    ? { isAvailable: false, outOfStockReason: trimmed }
    : { isAvailable: false };
}

interface AvailabilityToggleProps {
  itemId: string;
  isAvailable: boolean;
  outOfStockReason?: string;
}

export function AvailabilityToggle({ itemId, isAvailable, outOfStockReason }: AvailabilityToggleProps) {
  const [reason, setReason] = useState(outOfStockReason ?? "");
  const setAvailability = useSetItemAvailability();

  const apply = (nextAvailable: boolean, nextReason: string) => {
    setAvailability.mutate(
      { itemId, input: buildAvailabilityInput(nextAvailable, nextReason) },
      {
        onSuccess: () => toast.success(nextAvailable ? "Marked available" : "Marked unavailable"),
        onError: (error) => toast.error(menuItemErrorMessage(error)),
      },
    );
  };

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={isAvailable}
        disabled={setAvailability.isPending}
        aria-label="Toggle availability"
        onCheckedChange={(checked) => apply(checked, reason)}
      />
      <span className="text-xs text-muted-foreground">{isAvailable ? "Available" : "Unavailable"}</span>
      {!isAvailable && (
        <div className="flex items-center gap-1">
          <Input
            className="h-7 w-40 text-xs"
            placeholder="Out-of-stock reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={setAvailability.isPending}
            onClick={() => apply(false, reason)}
          >
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
