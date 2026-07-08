"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save } from "lucide-react";
import { ApiError } from "@/lib/api/errors/ApiError";
import { DIETARY_TAGS, type DietaryTag } from "@/lib/api";
import type { OwnerCategoryResponse } from "@/lib/api/adapters/restaurantOwner";
import { ImageUpload } from "../../ImageUpload";

/**
 * Admin form view-model for menu-item create/edit. Mirrors
 * `addMenuItemSchema`/`updateMenuItemSchema` (Phase-10.md Batch 10.0 §"Request
 * body shapes"). `price` is edited in MAJOR units here; the `menuOwner` adapter
 * converts to integer minor units and emits `basePrice` (create) vs `price`
 * (update) — Batch 10.0 §6.
 */
export interface MenuItemFormState {
  categoryId: string;
  name: string;
  description: string;
  /** Major units (e.g. 250.00). */
  price: number;
  dietary: DietaryTag[];
  /** Comma-separated free text; split to an array on submit. */
  tagsText: string;
}

export interface MenuItemFormValidation {
  valid: boolean;
  categoryError: string | null;
  nameError: string | null;
  descriptionError: string | null;
  priceError: string | null;
  tagsError: string | null;
}

/** Split the comma-separated tags input into a trimmed, de-duplicated list. */
export function parseTags(text: string): string[] {
  const seen = new Set<string>();
  for (const raw of text.split(",")) {
    const tag = raw.trim();
    if (tag.length > 0) seen.add(tag);
  }
  return [...seen];
}

export function validateMenuItemForm(values: MenuItemFormState): MenuItemFormValidation {
  const categoryError = values.categoryId.trim().length === 0 ? "Select a category" : null;

  const nameError =
    values.name.trim().length === 0
      ? "Name is required"
      : values.name.length > 120
        ? "Name must be 120 characters or fewer"
        : null;

  const descriptionError =
    values.description.length > 2000 ? "Description must be 2000 characters or fewer" : null;

  const priceError =
    Number.isNaN(values.price) || values.price < 0 ? "Price must be 0 or more" : null;

  const tagsError = parseTags(values.tagsText).some((t) => t.length > 40)
    ? "Each tag must be 40 characters or fewer"
    : null;

  const valid = [categoryError, nameError, descriptionError, priceError, tagsError].every(
    (e) => e === null,
  );

  return { valid, categoryError, nameError, descriptionError, priceError, tagsError };
}

/** Friendly message for owner-write errors (Phase-10.md Batch 10.0 §10). */
export function menuItemErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return "This item changed elsewhere — refresh and try again.";
    if (error.status === 403) return "You don't have permission to manage this menu.";
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

export function emptyMenuItemFormState(categoryId = ""): MenuItemFormState {
  return { categoryId, name: "", description: "", price: 0, dietary: [], tagsText: "" };
}

interface MenuItemFormProps {
  initial: MenuItemFormState;
  categories: OwnerCategoryResponse[];
  isEdit: boolean;
  imageUrl?: string;
  onImageSelected: (file: File | null) => void;
  onSubmit: (values: MenuItemFormState) => void;
  onCancel: () => void;
  submitting: boolean;
}

export function MenuItemForm({
  initial,
  categories,
  isEdit,
  imageUrl,
  onImageSelected,
  onSubmit,
  onCancel,
  submitting,
}: MenuItemFormProps) {
  const [values, setValues] = useState<MenuItemFormState>(initial);
  const [touched, setTouched] = useState(false);

  const validation = validateMenuItemForm(values);

  const toggleDietary = (tag: DietaryTag, checked: boolean) => {
    setValues((v) => ({
      ...v,
      dietary: checked ? [...v.dietary, tag] : v.dietary.filter((d) => d !== tag),
    }));
  };

  const handleSubmit = () => {
    setTouched(true);
    if (!validation.valid) return;
    onSubmit(values);
  };

  return (
    <div className="space-y-4 py-4">
      <ImageUpload
        value={imageUrl}
        onChange={(file) => onImageSelected(file)}
        label="Item Image"
        maxSizeBytes={5 * 1024 * 1024}
      />

      <div>
        <Label htmlFor="menu-category">Category *</Label>
        <Select
          value={values.categoryId}
          onValueChange={(categoryId) => setValues({ ...values, categoryId })}
        >
          <SelectTrigger id="menu-category" aria-label="Category">
            <SelectValue placeholder={categories.length ? "Choose a category" : "No categories yet"} />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
                {!c.isActive ? " (inactive)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {touched && validation.categoryError && (
          <p className="text-sm text-destructive mt-1">{validation.categoryError}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="menu-name">Name *</Label>
          <Input
            id="menu-name"
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
          />
          {touched && validation.nameError && (
            <p className="text-sm text-destructive mt-1">{validation.nameError}</p>
          )}
        </div>
        <div>
          <Label htmlFor="menu-price">Price *</Label>
          <Input
            id="menu-price"
            type="number"
            step="0.01"
            value={values.price}
            onChange={(e) => setValues({ ...values, price: parseFloat(e.target.value) || 0 })}
          />
          {touched && validation.priceError && (
            <p className="text-sm text-destructive mt-1">{validation.priceError}</p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="menu-description">Description</Label>
        <Textarea
          id="menu-description"
          rows={3}
          value={values.description}
          onChange={(e) => setValues({ ...values, description: e.target.value })}
        />
        {touched && validation.descriptionError && (
          <p className="text-sm text-destructive mt-1">{validation.descriptionError}</p>
        )}
      </div>

      <div>
        <Label>Dietary tags</Label>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {DIETARY_TAGS.map((tag) => (
            <div key={tag} className="flex items-center gap-2">
              <Checkbox
                id={`dietary-${tag}`}
                checked={values.dietary.includes(tag)}
                onCheckedChange={(checked) => toggleDietary(tag, checked === true)}
              />
              <Label htmlFor={`dietary-${tag}`} className="cursor-pointer text-xs font-normal">
                {tag.replace(/_/g, " ")}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="menu-tags">Tags (comma-separated)</Label>
        <Input
          id="menu-tags"
          placeholder="popular, chef-special"
          value={values.tagsText}
          onChange={(e) => setValues({ ...values, tagsText: e.target.value })}
        />
        {touched && validation.tagsError && (
          <p className="text-sm text-destructive mt-1">{validation.tagsError}</p>
        )}
      </div>

      <Button onClick={handleSubmit} disabled={submitting} className="w-full">
        <Save className="h-4 w-4 mr-2" />
        {submitting ? "Saving…" : isEdit ? "Update Item" : "Add Item"}
      </Button>
      <Button onClick={onCancel} variant="outline" className="w-full">
        Cancel
      </Button>
    </div>
  );
}
