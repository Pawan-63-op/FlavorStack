import { describe, expect, it } from "vitest";
import * as api from "../index";
import { authService } from "./auth";
import { cartService } from "./cart";
import { catalogService } from "./catalog";
import { notificationService } from "./notification";
import { reviewService } from "./review";

describe("service scaffolding (smoke)", () => {
  it("constructs every service module from the composed client", () => {
    expect(authService).toBeDefined();
    expect(catalogService).toBeDefined();
    expect(cartService).toBeDefined();
    expect(reviewService).toBeDefined();
    expect(notificationService).toBeDefined();
  });

  it("re-exports the public API surface through the barrel", () => {
    expect(api.client).toBeDefined();
    expect(api.ApiError).toBeDefined();
    expect(api.normalizeError).toBeTypeOf("function");
    expect(api.normalizePage).toBeTypeOf("function");
    expect(api.formatMoney).toBeTypeOf("function");
    expect(api.isEnabled).toBeTypeOf("function");
    expect(api.queryKeys).toBeDefined();
    expect(api.authService).toBe(authService);
    expect(api.userAdapter).toBeTypeOf("function");
    expect(api.reviewAdapter).toBeTypeOf("function");
    expect(api.restaurantRatingAdapter).toBeTypeOf("function");
  });
});

describe("queryKeys factory", () => {
  it("namespaces keys per domain", () => {
    expect(api.queryKeys.auth.me()).toEqual(["auth", "me"]);
    expect(api.queryKeys.catalog.restaurant("r1")).toEqual([
      "catalog",
      "restaurant",
      "r1",
    ]);
    expect(api.queryKeys.cart.current()).toEqual(["cart"]);
  });

  it("threads pagination cursors into list keys", () => {
    expect(api.queryKeys.catalog.restaurants("c1")).toEqual([
      "catalog",
      "restaurants",
      { cursor: "c1" },
    ]);
  });
});
