import { getReporter, type MetricTags } from "./reporter";

/**
 * The operationally-critical FE counters (Phase 12, Batch 12.4). Kept to the
 * three events worth alerting on — session loss and revenue-critical failure —
 * rather than instrumenting every handled error.
 */
export const METRICS = {
  /** A token-refresh cycle failed → true session loss. */
  authRefreshFailure: "auth.refresh.failure",
  /** An intercepted 401 that triggered the refresh path. */
  auth401: "auth.401",
  /** A checkout preview or place-order request failed. */
  checkoutFailure: "checkout.failure",
} as const;

export type MetricName = (typeof METRICS)[keyof typeof METRICS];

function increment(name: MetricName, tags?: MetricTags): void {
  getReporter().incrementMetric(name, tags);
}

export function recordAuthRefreshFailure(tags?: MetricTags): void {
  increment(METRICS.authRefreshFailure, tags);
}

export function recordAuth401(tags?: MetricTags): void {
  increment(METRICS.auth401, tags);
}

export function recordCheckoutFailure(tags?: MetricTags): void {
  increment(METRICS.checkoutFailure, tags);
}
