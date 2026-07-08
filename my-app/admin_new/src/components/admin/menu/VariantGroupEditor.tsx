"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { useSetItemVariants } from "@/lib/api/hooks/useOwnerCatalog";
import { SELECTION_TYPES, type SelectionType, type VariantGroupInput, type VariantOptionInput } from "@/lib/api";
import type { ItemVariantGroupView } from "@/lib/api/adapters/menuOwner";
import { menuItemErrorMessage } from "./MenuItemForm";

/**
 * Variant editor for `PUT /catalog/items/:id/variants` — the endpoint REPLACES
 * the whole `groups[]` set, so this edits the full list locally and saves it
 * atomically. Option `priceDelta` is edited in MAJOR units (the `menuOwner`
 * adapter converts to minor on submit). Batch 10.0 §2 variant shape.
 */
export function emptyVariantOption(): VariantOptionInput {
  return { label: "", priceDelta: 0, isDefault: false, isAvailable: true };
}

export function emptyVariantGroup(): VariantGroupInput {
  return { label: "", selectionType: "SINGLE", required: false, minSelect: 0, maxSelect: 1, options: [] };
}

/** Map server view groups (priceDelta in major-unit `Money`) → editable input shape. */
export function viewGroupsToInput(viewGroups: ItemVariantGroupView[]): VariantGroupInput[] {
  return viewGroups.map((g) => ({
    label: g.label,
    selectionType: g.selectionType,
    required: g.required,
    minSelect: g.minSelect,
    maxSelect: g.maxSelect,
    options: g.options.map((o) => ({
      label: o.label,
      priceDelta: o.priceDelta.amount ?? 0,
      isDefault: o.isDefault,
      isAvailable: o.isAvailable,
    })),
  }));
}

/** First validation error across all groups, or null. Mirrors the server variant rules. */
export function validateVariantGroups(groups: VariantGroupInput[]): string | null {
  for (const group of groups) {
    if (group.label.trim().length === 0) return "Every variant group needs a label";
    if (group.label.length > 80) return "Group label must be 80 characters or fewer";
    if (!Number.isInteger(group.minSelect) || group.minSelect < 0) return "Min select must be 0 or more";
    if (!Number.isInteger(group.maxSelect) || group.maxSelect < 1) return "Max select must be 1 or more";
    if (group.minSelect > group.maxSelect) return "Min select cannot exceed max select";
    for (const option of group.options ?? []) {
      if (option.label.trim().length === 0) return "Every option needs a label";
      if (option.label.length > 80) return "Option label must be 80 characters or fewer";
    }
  }
  return null;
}

interface VariantGroupEditorProps {
  itemId: string;
  groups: ItemVariantGroupView[];
  /** Currency for option price deltas (from the item's base price). */
  currency?: string;
}

export function VariantGroupEditor({ itemId, groups, currency }: VariantGroupEditorProps) {
  const [draft, setDraft] = useState<VariantGroupInput[]>(() => viewGroupsToInput(groups));
  const setVariants = useSetItemVariants();

  const patchGroup = (index: number, patch: Partial<VariantGroupInput>) => {
    setDraft((d) => d.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  };

  const patchOption = (gi: number, oi: number, patch: Partial<VariantOptionInput>) => {
    setDraft((d) =>
      d.map((g, i) =>
        i === gi
          ? { ...g, options: (g.options ?? []).map((o, j) => (j === oi ? { ...o, ...patch } : o)) }
          : g,
      ),
    );
  };

  const addGroup = () => setDraft((d) => [...d, emptyVariantGroup()]);
  const removeGroup = (index: number) => setDraft((d) => d.filter((_, i) => i !== index));
  const addOption = (gi: number) =>
    patchGroup(gi, { options: [...(draft[gi].options ?? []), emptyVariantOption()] });
  const removeOption = (gi: number, oi: number) =>
    patchGroup(gi, { options: (draft[gi].options ?? []).filter((_, j) => j !== oi) });

  const handleSave = () => {
    const error = validateVariantGroups(draft);
    if (error) {
      toast.error(error);
      return;
    }
    const withCurrency = draft.map((g) => ({ ...g, currency }));
    setVariants.mutate(
      { itemId, groups: withCurrency },
      {
        onSuccess: () => toast.success("Variants saved"),
        onError: (error) => toast.error(menuItemErrorMessage(error)),
      },
    );
  };

  return (
    <div className="space-y-4">
      {draft.length === 0 && (
        <p className="text-sm text-muted-foreground">No variant groups — add one below (e.g. Size, Add-ons).</p>
      )}

      {draft.map((group, gi) => (
        <div key={gi} className="rounded-lg border p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Input
              aria-label={`Group ${gi + 1} label`}
              placeholder="Group label (e.g. Size)"
              value={group.label}
              onChange={(e) => patchGroup(gi, { label: e.target.value })}
            />
            <Select
              value={group.selectionType}
              onValueChange={(v) => patchGroup(gi, { selectionType: v as SelectionType })}
            >
              <SelectTrigger className="w-28" aria-label={`Group ${gi + 1} selection type`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SELECTION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" aria-label={`Remove group ${gi + 1}`} onClick={() => removeGroup(gi)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>

          <div className="flex items-center gap-4 flex-wrap text-sm">
            <div className="flex items-center gap-2">
              <Label htmlFor={`min-${gi}`} className="text-xs">Min</Label>
              <Input
                id={`min-${gi}`}
                type="number"
                className="h-8 w-20"
                value={group.minSelect}
                onChange={(e) => patchGroup(gi, { minSelect: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor={`max-${gi}`} className="text-xs">Max</Label>
              <Input
                id={`max-${gi}`}
                type="number"
                className="h-8 w-20"
                value={group.maxSelect}
                onChange={(e) => patchGroup(gi, { maxSelect: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id={`required-${gi}`}
                checked={group.required}
                onCheckedChange={(checked) => patchGroup(gi, { required: checked === true })}
              />
              <Label htmlFor={`required-${gi}`} className="text-xs cursor-pointer">Required</Label>
            </div>
          </div>

          <div className="space-y-2">
            {(group.options ?? []).map((option, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <Input
                  aria-label={`Group ${gi + 1} option ${oi + 1} label`}
                  placeholder="Option label"
                  value={option.label}
                  onChange={(e) => patchOption(gi, oi, { label: e.target.value })}
                />
                <Input
                  aria-label={`Group ${gi + 1} option ${oi + 1} price delta`}
                  type="number"
                  step="0.01"
                  className="w-28"
                  placeholder="+ price"
                  value={option.priceDelta}
                  onChange={(e) => patchOption(gi, oi, { priceDelta: parseFloat(e.target.value) || 0 })}
                />
                <div className="flex items-center gap-1">
                  <Checkbox
                    id={`default-${gi}-${oi}`}
                    checked={option.isDefault}
                    onCheckedChange={(checked) => patchOption(gi, oi, { isDefault: checked === true })}
                  />
                  <Label htmlFor={`default-${gi}-${oi}`} className="text-xs cursor-pointer">Default</Label>
                </div>
                <Button variant="ghost" size="icon" aria-label={`Remove group ${gi + 1} option ${oi + 1}`} onClick={() => removeOption(gi, oi)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addOption(gi)}>
              <Plus className="h-3 w-3 mr-1" /> Add option
            </Button>
          </div>
        </div>
      ))}

      <div className="flex gap-2">
        <Button variant="outline" onClick={addGroup}>
          <Plus className="h-4 w-4 mr-1" /> Add group
        </Button>
        <Button onClick={handleSave} disabled={setVariants.isPending}>
          <Save className="h-4 w-4 mr-1" /> Save variants
        </Button>
      </div>
    </div>
  );
}
