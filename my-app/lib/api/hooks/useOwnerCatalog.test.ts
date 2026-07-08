import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import {
  invalidateOwnerMenu,
  invalidateOwnerRestaurant,
  isVersionConflict,
} from "./useOwnerCatalog";
import { ApiError } from "../errors/ApiError";
import { queryKeys } from "../queryKeys";

describe("isVersionConflict", () => {
  it("is true only for a 409 ApiError", () => {
    expect(isVersionConflict(new ApiError({ status: 409, code: "CONFLICT", message: "x" }))).toBe(
      true,
    );
    expect(isVersionConflict(new ApiError({ status: 422, code: "VALIDATION_ERROR", message: "x" }))).toBe(
      false,
    );
    expect(isVersionConflict(new Error("boom"))).toBe(false);
    expect(isVersionConflict(undefined)).toBe(false);
  });
});

describe("invalidateOwnerRestaurant", () => {
  it("invalidates the owner list and the specific restaurant detail", () => {
    const invalidateQueries = vi.fn();
    const qc = { invalidateQueries } as unknown as QueryClient;
    invalidateOwnerRestaurant(qc, "r1");
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.ownerCatalog.restaurants(),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.ownerCatalog.restaurant("r1"),
    });
  });
});

describe("invalidateOwnerMenu", () => {
  it("invalidates that restaurant's menu cache", () => {
    const invalidateQueries = vi.fn();
    const qc = { invalidateQueries } as unknown as QueryClient;
    invalidateOwnerMenu(qc, "r1");
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.ownerCatalog.menu("r1"),
    });
  });
});
