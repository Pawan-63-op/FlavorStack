import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors/ApiError";
import {
  restaurantErrorMessage,
  validateRestaurantForm,
  type RestaurantFormValues,
} from "./RestaurantForm";

function values(overrides: Partial<RestaurantFormValues> = {}): RestaurantFormValues {
  return {
    name: "Spice Hub",
    slug: "",
    description: "",
    cuisineTypes: ["NORTH_INDIAN"],
    street: "12 MG Road",
    city: "Pune",
    state: "Maharashtra",
    pinCode: "411001",
    addressLabel: "",
    lat: 18.52,
    lng: 73.85,
    phone: "+15551230001",
    ...overrides,
  };
}

describe("validateRestaurantForm — name", () => {
  it("is invalid when empty", () => {
    const result = validateRestaurantForm(values({ name: "" }));
    expect(result.valid).toBe(false);
    expect(result.nameError).not.toBeNull();
  });

  it("is invalid over 120 chars", () => {
    const result = validateRestaurantForm(values({ name: "x".repeat(121) }));
    expect(result.valid).toBe(false);
    expect(result.nameError).not.toBeNull();
  });

  it("is valid at the 120 char boundary", () => {
    expect(validateRestaurantForm(values({ name: "x".repeat(120) })).valid).toBe(true);
  });
});

describe("validateRestaurantForm — slug (optional)", () => {
  it("is valid when omitted", () => {
    expect(validateRestaurantForm(values({ slug: "" })).slugError).toBeNull();
  });

  it("is valid for a lowercase-hyphen slug", () => {
    const result = validateRestaurantForm(values({ slug: "spice-hub-pune" }));
    expect(result.valid).toBe(true);
    expect(result.slugError).toBeNull();
  });

  it("is invalid for uppercase or spaces", () => {
    expect(validateRestaurantForm(values({ slug: "Spice Hub" })).slugError).not.toBeNull();
  });

  it("is invalid for a leading/trailing hyphen", () => {
    expect(validateRestaurantForm(values({ slug: "-spice-hub" })).slugError).not.toBeNull();
  });
});

describe("validateRestaurantForm — cuisineTypes", () => {
  it("is invalid when empty", () => {
    const result = validateRestaurantForm(values({ cuisineTypes: [] }));
    expect(result.valid).toBe(false);
    expect(result.cuisineTypesError).not.toBeNull();
  });

  it("is valid with at least one cuisine", () => {
    expect(validateRestaurantForm(values({ cuisineTypes: ["ITALIAN"] })).valid).toBe(true);
  });
});

describe("validateRestaurantForm — address", () => {
  it("requires street/city/state/pinCode", () => {
    const result = validateRestaurantForm(
      values({ street: "", city: "", state: "", pinCode: "" }),
    );
    expect(result.valid).toBe(false);
    expect(result.streetError).not.toBeNull();
    expect(result.cityError).not.toBeNull();
    expect(result.stateError).not.toBeNull();
    expect(result.pinCodeError).not.toBeNull();
  });

  it("rejects a pinCode shorter than 3 chars", () => {
    expect(validateRestaurantForm(values({ pinCode: "1" })).pinCodeError).not.toBeNull();
  });

  it("rejects a pinCode longer than 12 chars", () => {
    expect(validateRestaurantForm(values({ pinCode: "1234567890123" })).pinCodeError).not.toBeNull();
  });
});

describe("validateRestaurantForm — coordinates", () => {
  it("rejects out-of-range latitude", () => {
    expect(validateRestaurantForm(values({ lat: 91 })).latError).not.toBeNull();
    expect(validateRestaurantForm(values({ lat: -91 })).latError).not.toBeNull();
  });

  it("rejects out-of-range longitude", () => {
    expect(validateRestaurantForm(values({ lng: 181 })).lngError).not.toBeNull();
    expect(validateRestaurantForm(values({ lng: -181 })).lngError).not.toBeNull();
  });

  it("accepts boundary coordinates", () => {
    const result = validateRestaurantForm(values({ lat: 90, lng: -180 }));
    expect(result.latError).toBeNull();
    expect(result.lngError).toBeNull();
  });
});

describe("validateRestaurantForm — phone", () => {
  it("rejects a phone shorter than 5 chars", () => {
    expect(validateRestaurantForm(values({ phone: "123" })).phoneError).not.toBeNull();
  });

  it("rejects a phone longer than 20 chars", () => {
    expect(validateRestaurantForm(values({ phone: "1".repeat(21) })).phoneError).not.toBeNull();
  });

  it("accepts a valid phone", () => {
    expect(validateRestaurantForm(values({ phone: "+15551230001" })).phoneError).toBeNull();
  });
});

describe("restaurantErrorMessage", () => {
  function apiError(code: string, message: string, status: number): ApiError {
    return new ApiError({ code, message, status });
  }

  it("maps a 409 version conflict to a refetch-and-retry message", () => {
    expect(restaurantErrorMessage(apiError("CONFLICT", "optimistic_lock_failed", 409))).toBe(
      "This restaurant changed elsewhere — refresh and try again.",
    );
  });

  it("maps a 403 ownership error to a clear message", () => {
    expect(restaurantErrorMessage(apiError("FORBIDDEN", "not_restaurant_owner", 403))).toBe(
      "You don't have permission to manage this restaurant.",
    );
  });

  it("surfaces a 422 validation message verbatim", () => {
    expect(
      restaurantErrorMessage(apiError("VALIDATION_ERROR", "Validation failed", 422)),
    ).toBe("Validation failed");
  });

  it("falls back to a generic message for a non-ApiError value", () => {
    expect(restaurantErrorMessage(new Error("boom"))).toContain("Something went wrong");
  });
});
