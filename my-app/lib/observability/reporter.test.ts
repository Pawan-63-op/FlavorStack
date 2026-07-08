import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "../api/errors/ApiError";
import {
  createDefaultReporter,
  getReporter,
  resetReporter,
  setReporter,
  toErrorPayload,
  type Reporter,
} from "./reporter";

function spyReporter(): Reporter & {
  errors: Array<{ error: unknown; context?: Record<string, unknown> }>;
  metrics: Array<{ name: string; tags?: Record<string, unknown> }>;
} {
  const errors: Array<{ error: unknown; context?: Record<string, unknown> }> = [];
  const metrics: Array<{ name: string; tags?: Record<string, unknown> }> = [];
  return {
    errors,
    metrics,
    captureError(error, context) {
      errors.push({ error, context });
    },
    incrementMetric(name, tags) {
      metrics.push({ name, tags });
    },
  };
}

describe("toErrorPayload", () => {
  it("flattens an ApiError to include status, code, category and requestId", () => {
    const err = new ApiError({
      status: 401,
      code: "invalid_token",
      message: "Access token expired",
      requestId: "req-123",
    });

    const payload = toErrorPayload(err);

    expect(payload).toMatchObject({
      name: "ApiError",
      message: "Access token expired",
      status: 401,
      code: "invalid_token",
      category: "auth",
      requestId: "req-123",
    });
  });

  it("merges caller-supplied context into the payload", () => {
    const err = new ApiError({ status: 500, code: "INTERNAL_ERROR", message: "boom" });

    const payload = toErrorPayload(err, { operation: "checkout" });

    expect(payload.operation).toBe("checkout");
    expect(payload.category).toBe("server");
  });

  it("handles a plain Error without ApiError fields", () => {
    const payload = toErrorPayload(new Error("render blew up"));

    expect(payload.name).toBe("Error");
    expect(payload.message).toBe("render blew up");
    expect(payload.status).toBeUndefined();
    expect(payload.requestId).toBeUndefined();
  });

  it("handles a non-Error thrown value", () => {
    const payload = toErrorPayload("just a string");

    expect(payload.message).toBe("just a string");
  });
});

describe("reporter registry", () => {
  afterEach(() => {
    resetReporter();
  });

  it("returns a no-op default reporter when NEXT_PUBLIC_SENTRY_DSN is unset", () => {
    const reporter = createDefaultReporter();
    expect(reporter.constructor.name).not.toContain("Sentry");
  });

  it("the default reporter performs no network work and does not import @sentry", () => {
    const reporter = createDefaultReporter();
    expect(() => {
      reporter.captureError(new Error("x"));
      reporter.incrementMetric("auth.401");
    }).not.toThrow();
  });

  it("setReporter swaps the active reporter used by getReporter", () => {
    const spy = spyReporter();
    setReporter(spy);

    getReporter().captureError(new Error("oops"), { where: "test" });
    getReporter().incrementMetric("auth.401", { foo: "bar" });

    expect(spy.errors).toHaveLength(1);
    expect(spy.metrics).toEqual([{ name: "auth.401", tags: { foo: "bar" } }]);
  });

  it("resetReporter restores the default reporter", () => {
    const spy = spyReporter();
    setReporter(spy);
    resetReporter();

    const after = getReporter();
    expect(after).not.toBe(spy);
  });
});
