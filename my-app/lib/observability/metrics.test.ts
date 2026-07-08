import { afterEach, describe, expect, it } from "vitest";
import { resetReporter, setReporter, type Reporter } from "./reporter";
import {
  METRICS,
  recordAuth401,
  recordAuthRefreshFailure,
  recordCheckoutFailure,
} from "./metrics";

function spyReporter(): Reporter & {
  metrics: Array<{ name: string; tags?: Record<string, unknown> }>;
} {
  const metrics: Array<{ name: string; tags?: Record<string, unknown> }> = [];
  return {
    metrics,
    captureError() {},
    incrementMetric(name, tags) {
      metrics.push({ name, tags });
    },
  };
}

describe("metrics", () => {
  afterEach(() => {
    resetReporter();
  });

  it("exposes the three operationally-critical metric names", () => {
    expect(METRICS).toEqual({
      authRefreshFailure: "auth.refresh.failure",
      auth401: "auth.401",
      checkoutFailure: "checkout.failure",
    });
  });

  it("recordAuthRefreshFailure increments auth.refresh.failure on the active reporter", () => {
    const spy = spyReporter();
    setReporter(spy);

    recordAuthRefreshFailure();

    expect(spy.metrics).toEqual([{ name: "auth.refresh.failure", tags: undefined }]);
  });

  it("recordAuth401 increments auth.401", () => {
    const spy = spyReporter();
    setReporter(spy);

    recordAuth401({ path: "/users/me" });

    expect(spy.metrics).toEqual([{ name: "auth.401", tags: { path: "/users/me" } }]);
  });

  it("recordCheckoutFailure increments checkout.failure", () => {
    const spy = spyReporter();
    setReporter(spy);

    recordCheckoutFailure({ operation: "checkout" });

    expect(spy.metrics).toEqual([
      { name: "checkout.failure", tags: { operation: "checkout" } },
    ]);
  });
});
