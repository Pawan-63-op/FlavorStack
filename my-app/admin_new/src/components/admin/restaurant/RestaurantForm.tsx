"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Save } from "lucide-react";
import { ApiError } from "@/lib/api/errors/ApiError";
import { CUISINE_TYPES, type CuisineType } from "@/lib/api";
import { ImageUpload } from "../../ImageUpload";

/**
 * Admin form view-model for restaurant create/edit. Mirrors
 * `createRestaurantSchema`/`updateRestaurantSchema` (Phase-10.md Batch 10.0
 * §"Request body shapes"). One lat/lng pair drives both `location` and
 * `address.coordinates` — the contract models them separately, but the admin
 * form captures a single pin for simplicity (no map UI in this batch).
 */
export interface RestaurantFormValues {
  name: string;
  /** Empty string = let the server auto-derive from `name`. Ignored on update (slug is immutable). */
  slug: string;
  description: string;
  cuisineTypes: CuisineType[];
  street: string;
  city: string;
  state: string;
  pinCode: string;
  addressLabel: string;
  lat: number;
  lng: number;
  phone: string;
}

export interface RestaurantFormValidation {
  valid: boolean;
  nameError: string | null;
  slugError: string | null;
  descriptionError: string | null;
  cuisineTypesError: string | null;
  streetError: string | null;
  cityError: string | null;
  stateError: string | null;
  pinCodeError: string | null;
  latError: string | null;
  lngError: string | null;
  phoneError: string | null;
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function validateRestaurantForm(values: RestaurantFormValues): RestaurantFormValidation {
  const nameError =
    values.name.trim().length === 0
      ? "Name is required"
      : values.name.length > 120
        ? "Name must be 120 characters or fewer"
        : null;

  const slugError =
    values.slug.length === 0
      ? null
      : values.slug.length > 140
        ? "Slug must be 140 characters or fewer"
        : !SLUG_PATTERN.test(values.slug)
          ? "Slug must be lowercase letters, numbers and hyphens (no leading/trailing hyphen)"
          : null;

  const descriptionError = values.description.length > 2000 ? "Description must be 2000 characters or fewer" : null;

  const cuisineTypesError = values.cuisineTypes.length === 0 ? "Select at least one cuisine" : null;

  const streetError =
    values.street.trim().length === 0
      ? "Street is required"
      : values.street.length > 200
        ? "Street must be 200 characters or fewer"
        : null;

  const cityError =
    values.city.trim().length === 0
      ? "City is required"
      : values.city.length > 80
        ? "City must be 80 characters or fewer"
        : null;

  const stateError =
    values.state.trim().length === 0
      ? "State is required"
      : values.state.length > 80
        ? "State must be 80 characters or fewer"
        : null;

  const pinCodeError =
    values.pinCode.trim().length < 3 || values.pinCode.length > 12
      ? "PIN code must be 3–12 characters"
      : null;

  const latError = values.lat < -90 || values.lat > 90 ? "Latitude must be between -90 and 90" : null;
  const lngError = values.lng < -180 || values.lng > 180 ? "Longitude must be between -180 and 180" : null;

  const phoneError =
    values.phone.length < 5 || values.phone.length > 20 ? "Phone must be 5–20 characters" : null;

  const valid = [
    nameError,
    slugError,
    descriptionError,
    cuisineTypesError,
    streetError,
    cityError,
    stateError,
    pinCodeError,
    latError,
    lngError,
    phoneError,
  ].every((e) => e === null);

  return {
    valid,
    nameError,
    slugError,
    descriptionError,
    cuisineTypesError,
    streetError,
    cityError,
    stateError,
    pinCodeError,
    latError,
    lngError,
    phoneError,
  };
}

/** Friendly message for owner-write errors (Phase-10.md Batch 10.0 §10). */
export function restaurantErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return "This restaurant changed elsewhere — refresh and try again.";
    if (error.status === 403) return "You don't have permission to manage this restaurant.";
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

export function emptyRestaurantFormValues(): RestaurantFormValues {
  return {
    name: "",
    slug: "",
    description: "",
    cuisineTypes: [],
    street: "",
    city: "",
    state: "",
    pinCode: "",
    addressLabel: "",
    lat: 0,
    lng: 0,
    phone: "",
  };
}

interface RestaurantFormProps {
  initial: RestaurantFormValues;
  /** Slug is immutable after create — hide the field on edit. */
  isEdit: boolean;
  imageUrl?: string;
  onImageSelected: (file: File | null) => void;
  onSubmit: (values: RestaurantFormValues) => void;
  onCancel: () => void;
  submitting: boolean;
}

export function RestaurantForm({
  initial,
  isEdit,
  imageUrl,
  onImageSelected,
  onSubmit,
  onCancel,
  submitting,
}: RestaurantFormProps) {
  const [values, setValues] = useState<RestaurantFormValues>(initial);
  const [touched, setTouched] = useState(false);

  const validation = validateRestaurantForm(values);

  const toggleCuisine = (cuisine: CuisineType, checked: boolean) => {
    setValues((v) => ({
      ...v,
      cuisineTypes: checked ? [...v.cuisineTypes, cuisine] : v.cuisineTypes.filter((c) => c !== cuisine),
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
        label="Restaurant Image"
        maxSizeBytes={5 * 1024 * 1024}
      />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="restaurant-name">Name *</Label>
          <Input
            id="restaurant-name"
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
          />
          {touched && validation.nameError && (
            <p className="text-sm text-destructive mt-1">{validation.nameError}</p>
          )}
        </div>
        {!isEdit && (
          <div>
            <Label htmlFor="restaurant-slug">Slug (optional — auto-generated if blank)</Label>
            <Input
              id="restaurant-slug"
              value={values.slug}
              onChange={(e) => setValues({ ...values, slug: e.target.value })}
            />
            {touched && validation.slugError && (
              <p className="text-sm text-destructive mt-1">{validation.slugError}</p>
            )}
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="restaurant-description">Description</Label>
        <Textarea
          id="restaurant-description"
          rows={3}
          value={values.description}
          onChange={(e) => setValues({ ...values, description: e.target.value })}
        />
        {touched && validation.descriptionError && (
          <p className="text-sm text-destructive mt-1">{validation.descriptionError}</p>
        )}
      </div>

      <div>
        <Label>Cuisine types *</Label>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {CUISINE_TYPES.map((cuisine) => (
            <div key={cuisine} className="flex items-center gap-2">
              <Checkbox
                checked={values.cuisineTypes.includes(cuisine)}
                onCheckedChange={(checked) => toggleCuisine(cuisine, checked === true)}
                id={`cuisine-${cuisine}`}
              />
              <Label htmlFor={`cuisine-${cuisine}`} className="cursor-pointer text-xs font-normal">
                {cuisine.replace(/_/g, " ")}
              </Label>
            </div>
          ))}
        </div>
        {touched && validation.cuisineTypesError && (
          <p className="text-sm text-destructive mt-1">{validation.cuisineTypesError}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="restaurant-street">Street *</Label>
          <Input
            id="restaurant-street"
            value={values.street}
            onChange={(e) => setValues({ ...values, street: e.target.value })}
          />
          {touched && validation.streetError && (
            <p className="text-sm text-destructive mt-1">{validation.streetError}</p>
          )}
        </div>
        <div>
          <Label htmlFor="restaurant-address-label">Address label</Label>
          <Input
            id="restaurant-address-label"
            value={values.addressLabel}
            onChange={(e) => setValues({ ...values, addressLabel: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="restaurant-city">City *</Label>
          <Input
            id="restaurant-city"
            value={values.city}
            onChange={(e) => setValues({ ...values, city: e.target.value })}
          />
          {touched && validation.cityError && (
            <p className="text-sm text-destructive mt-1">{validation.cityError}</p>
          )}
        </div>
        <div>
          <Label htmlFor="restaurant-state">State *</Label>
          <Input
            id="restaurant-state"
            value={values.state}
            onChange={(e) => setValues({ ...values, state: e.target.value })}
          />
          {touched && validation.stateError && (
            <p className="text-sm text-destructive mt-1">{validation.stateError}</p>
          )}
        </div>
        <div>
          <Label htmlFor="restaurant-pincode">PIN code *</Label>
          <Input
            id="restaurant-pincode"
            value={values.pinCode}
            onChange={(e) => setValues({ ...values, pinCode: e.target.value })}
          />
          {touched && validation.pinCodeError && (
            <p className="text-sm text-destructive mt-1">{validation.pinCodeError}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="restaurant-lat">Latitude *</Label>
          <Input
            id="restaurant-lat"
            type="number"
            value={values.lat}
            onChange={(e) => setValues({ ...values, lat: parseFloat(e.target.value) || 0 })}
          />
          {touched && validation.latError && (
            <p className="text-sm text-destructive mt-1">{validation.latError}</p>
          )}
        </div>
        <div>
          <Label htmlFor="restaurant-lng">Longitude *</Label>
          <Input
            id="restaurant-lng"
            type="number"
            value={values.lng}
            onChange={(e) => setValues({ ...values, lng: parseFloat(e.target.value) || 0 })}
          />
          {touched && validation.lngError && (
            <p className="text-sm text-destructive mt-1">{validation.lngError}</p>
          )}
        </div>
        <div>
          <Label htmlFor="restaurant-phone">Phone *</Label>
          <Input
            id="restaurant-phone"
            value={values.phone}
            onChange={(e) => setValues({ ...values, phone: e.target.value })}
          />
          {touched && validation.phoneError && (
            <p className="text-sm text-destructive mt-1">{validation.phoneError}</p>
          )}
        </div>
      </div>

      <Button onClick={handleSubmit} disabled={submitting} className="w-full">
        <Save className="h-4 w-4 mr-2" />
        {submitting ? "Saving…" : isEdit ? "Update Restaurant" : "Create Restaurant"}
      </Button>
      <Button onClick={onCancel} variant="outline" className="w-full">
        Cancel
      </Button>
    </div>
  );
}
