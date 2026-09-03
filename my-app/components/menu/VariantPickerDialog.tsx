"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, ShoppingCart } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { useMenuItem } from "@/lib/api/hooks/useCatalog";
import { formatMoney } from "@/lib/api/format/money";
import { ApiError } from "@/lib/api/errors/ApiError";
import type { MenuItemViewModel } from "@/lib/api/adapters/menu";
import {
  defaultSelection,
  isSelectionValid,
  selectedOptionIds,
  selectionDeltaMinor,
  toggleOption,
  validateSelection,
  type VariantSelection,
} from "./variantSelection";

export interface VariantPickerResult {
  selectedOptionIds: string[];
  /** Base price + selected deltas, integer minor units — the cart `unitPrice`. */
  unitPriceMinor: { amount: number; currency: string };
}

interface VariantPickerDialogProps {
  /** The list-view item being configured; `null` closes the dialog. */
  item: MenuItemViewModel | null;
  quantity: number;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (result: VariantPickerResult) => void;
}

/**
 * Customer-side variant picker. The menu list carries only `hasVariants`, so the groups
 * are fetched here for the single item being opened (`GET /catalog/items/:id`).
 * Required groups are enforced before "Add to cart" enables, and the running total
 * shows the price delta live.
 */
export function VariantPickerDialog({
  item,
  quantity,
  isSubmitting = false,
  onClose,
  onConfirm,
}: VariantPickerDialogProps) {
  const { data: detail, isLoading, isError, error } = useMenuItem(item?.id);
  const [selection, setSelection] = useState<VariantSelection>({});

  const groups = useMemo(() => detail?.variantGroups ?? [], [detail]);

  // Re-seed the defaults whenever a different item's groups arrive, so reopening the
  // dialog never inherits the previous item's selection.
  useEffect(() => {
    setSelection(defaultSelection(groups));
  }, [groups]);

  const errors = validateSelection(groups, selection);
  const canConfirm = groups.length > 0 && isSelectionValid(groups, selection);
  const deltaMinor = selectionDeltaMinor(groups, selection);
  const baseMinor = detail?.unitPriceMinor.amount ?? item?.unitPriceMinor.amount ?? 0;
  const currency = detail?.unitPriceMinor.currency ?? item?.unitPriceMinor.currency ?? "INR";
  const unitMinor = baseMinor + deltaMinor;
  const lineTotal = formatMoney({ amount: (unitMinor * quantity) / 100, currency });

  const confirm = () => {
    if (!canConfirm) return;
    onConfirm({
      selectedOptionIds: selectedOptionIds(groups, selection),
      unitPriceMinor: { amount: unitMinor, currency },
    });
  };

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item?.name ?? "Choose options"}</DialogTitle>
          <DialogDescription>
            {item?.description ?? "Pick your options before adding this to the cart."}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading options...
          </div>
        )}

        {isError && (
          <p className="py-6 text-sm text-destructive">
            {error instanceof ApiError ? error.message : "Could not load this item's options."}
          </p>
        )}

        {!isLoading && !isError && groups.length === 0 && (
          <p className="py-6 text-sm text-muted-foreground">
            This item has no options to choose.
          </p>
        )}

        {groups.map((group) => {
          const selected = selection[group.id] ?? [];
          const isSingle = group.selectionType === "SINGLE" || group.maxSelect <= 1;
          const atMax = selected.length >= group.maxSelect;

          return (
            <div key={group.id} className="space-y-3">
              <Separator />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{group.label}</span>
                  {group.required ? (
                    <Badge variant="destructive" className="text-xs">
                      Required
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      Optional
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {isSingle ? "Choose 1" : `Choose up to ${group.maxSelect}`}
                </span>
              </div>

              {isSingle ? (
                <RadioGroup
                  value={selected[0] ?? ""}
                  onValueChange={(optionId) =>
                    setSelection((prev) => toggleOption(prev, group, optionId))
                  }
                  className="space-y-2"
                >
                  {group.options.map((option) => (
                    <div key={option.id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <RadioGroupItem
                          value={option.id}
                          id={option.id}
                          disabled={!option.isAvailable}
                        />
                        <Label
                          htmlFor={option.id}
                          className={option.isAvailable ? "" : "text-muted-foreground"}
                        >
                          {option.label}
                          {!option.isAvailable && " (unavailable)"}
                        </Label>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {option.formattedPriceDelta}
                      </span>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <div className="space-y-2">
                  {group.options.map((option) => {
                    const isChecked = selected.includes(option.id);
                    return (
                      <div key={option.id} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={option.id}
                            checked={isChecked}
                            disabled={!option.isAvailable || (atMax && !isChecked)}
                            onCheckedChange={() =>
                              setSelection((prev) => toggleOption(prev, group, option.id))
                            }
                          />
                          <Label
                            htmlFor={option.id}
                            className={option.isAvailable ? "" : "text-muted-foreground"}
                          >
                            {option.label}
                            {!option.isAvailable && " (unavailable)"}
                          </Label>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {option.formattedPriceDelta}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {errors[group.id] && (
                <p className="text-xs text-destructive">{errors[group.id]}</p>
              )}
            </div>
          );
        })}

        <DialogFooter className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {quantity} × {formatMoney({ amount: unitMinor / 100, currency })} ={" "}
            <span className="font-semibold text-foreground">{lineTotal}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={confirm} disabled={!canConfirm || isSubmitting} className="gap-2">
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShoppingCart className="h-4 w-4" />
              )}
              Add to cart
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default VariantPickerDialog;
