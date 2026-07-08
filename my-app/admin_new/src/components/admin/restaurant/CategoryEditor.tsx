"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ArrowUp, ArrowDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useAddCategory,
  useRemoveCategory,
  useReorderCategories,
  useUpdateCategory,
} from "@/lib/api/hooks/useOwnerCatalog";
import { restaurantErrorMessage } from "./RestaurantForm";
import type { OwnerCategoryResponse } from "@/lib/api/adapters/restaurantOwner";

export function validateCategoryLabel(label: string): string | null {
  return label.trim().length === 0 ? "Label is required" : null;
}

/** Swap an id with its neighbour for the up/down reorder controls. */
export function moveCategoryId(
  ids: string[],
  index: number,
  direction: "up" | "down",
): string[] {
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= ids.length) return ids;
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

interface CategoryEditorProps {
  restaurantId: string;
  categories: OwnerCategoryResponse[];
}

export function CategoryEditor({ restaurantId, categories }: CategoryEditorProps) {
  const [newLabel, setNewLabel] = useState("");
  const addCategory = useAddCategory();
  const updateCategory = useUpdateCategory();
  const removeCategory = useRemoveCategory();
  const reorderCategories = useReorderCategories();

  const handleAdd = () => {
    const error = validateCategoryLabel(newLabel);
    if (error) {
      toast.error(error);
      return;
    }
    addCategory.mutate(
      { id: restaurantId, form: { label: newLabel.trim() } },
      {
        onSuccess: () => {
          toast.success("Category added");
          setNewLabel("");
        },
        onError: (error) => toast.error(restaurantErrorMessage(error)),
      },
    );
  };

  const handleToggleActive = (categoryId: string, isActive: boolean) => {
    updateCategory.mutate(
      { id: restaurantId, categoryId, input: { isActive } },
      { onError: (error) => toast.error(restaurantErrorMessage(error)) },
    );
  };

  const handleRemove = (categoryId: string) => {
    removeCategory.mutate(
      { id: restaurantId, categoryId },
      {
        onSuccess: () => toast.success("Category removed"),
        onError: (error) => toast.error(restaurantErrorMessage(error)),
      },
    );
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const orderedCategoryIds = moveCategoryId(categories.map((c) => c.id), index, direction);
    reorderCategories.mutate(
      { id: restaurantId, orderedCategoryIds },
      { onError: (error) => toast.error(restaurantErrorMessage(error)) },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="New category label"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
        />
        <Button onClick={handleAdd} disabled={addCategory.isPending}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">No categories yet — publish requires at least one active category.</p>
      ) : (
        <ul className="space-y-2">
          {categories.map((category, index) => (
            <li key={category.id} className="flex items-center gap-3 rounded-lg border p-2">
              <div className="flex flex-col">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  disabled={index === 0}
                  onClick={() => handleMove(index, "up")}
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  disabled={index === categories.length - 1}
                  onClick={() => handleMove(index, "down")}
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>
              <span className="flex-1">{category.label}</span>
              <Badge variant={category.isActive ? "default" : "outline"}>
                {category.isActive ? "Active" : "Inactive"}
              </Badge>
              <Switch
                checked={category.isActive}
                onCheckedChange={(checked) => handleToggleActive(category.id, checked)}
              />
              <Button variant="ghost" size="icon" onClick={() => handleRemove(category.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
