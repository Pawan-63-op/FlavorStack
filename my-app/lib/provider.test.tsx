import { describe, expect, it } from "vitest";
import { ApiError } from "./api/errors/ApiError";
import { shouldRetryQuery } from "./provider";

function apiError(status: number): ApiError {
  return new ApiError({ status, code: "X", message: "x" });
}

describe("shouldRetryQuery (QueryClient retry policy)", () => {
  it("never retries 4xx ApiErrors (validation/auth/forbidden/notFound/conflict/rateLimit)", () => {
    for (const status of [401, 403, 404, 409, 422, 429]) {
      expect(shouldRetryQuery(0, apiError(status))).toBe(false);
    }
  });

  it("retries server (5xx) and network errors up to the cap", () => {
    expect(shouldRetryQuery(0, apiError(500))).toBe(true);
    expect(shouldRetryQuery(0, new ApiError({ code: "NET", message: "n" }))).toBe(
      true,
    );
  });

  it("stops retrying once the failure cap is reached", () => {
    expect(shouldRetryQuery(2, apiError(500))).toBe(false);
  });

  it("retries unknown (non-ApiError) errors up to the cap", () => {
    expect(shouldRetryQuery(0, new Error("boom"))).toBe(true);
    expect(shouldRetryQuery(5, new Error("boom"))).toBe(false);
  });
});
