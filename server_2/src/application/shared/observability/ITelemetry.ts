// Telemetry port (Commerce Phase 14, commerce_module.md §11) — the application-layer
// abstraction over structured logging, metrics, and tracing. Use cases depend only on
// this interface; the concrete pino/metrics implementation lives in infrastructure and
// is wired in the container, preserving the inward-only dependency rule (CLAUDE.md).
//
// Kept generic (not commerce-specific) so other contexts can adopt the same port. The
// commerce-flavoured façade (metric names + domain-named emitters) is CommerceTelemetry,
// which composes an ITelemetry.

/** Arbitrary structured fields attached to a log line or span. JSON-serializable. */
export type LogFields = Record<string, unknown>;

/** Metric label set — low-cardinality dimensions only (result, reason, …). */
export type MetricLabels = Record<string, string | number | boolean>;

/** An open tracing span; `end`/`fail` close it and return the elapsed milliseconds. */
export interface ISpan {
  /** Close the span successfully; returns elapsed ms. Records a duration observation. */
  end(fields?: LogFields): number;
  /** Close the span as failed; returns elapsed ms. */
  fail(error?: unknown, fields?: LogFields): number;
}

export interface ITelemetry {
  // ── structured logging ──────────────────────────────────────────
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;

  // ── metrics ─────────────────────────────────────────────────────
  /** Increment a counter (default by 1). */
  increment(metric: string, labels?: MetricLabels, by?: number): void;
  /** Record a value into a histogram (latency/lag/size). */
  observe(metric: string, value: number, labels?: MetricLabels): void;

  // ── tracing ─────────────────────────────────────────────────────
  /** Open a span; the returned handle records duration on end/fail. */
  startSpan(name: string, fields?: LogFields): ISpan;
}
