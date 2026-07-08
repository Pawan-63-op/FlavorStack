import { ApiError } from "../api/errors/ApiError";

/**
 * Vendor-agnostic FE observability layer (Phase 12, Batch 12.4).
 *
 * The whole app reports through the {@link Reporter} interface; the concrete
 * sink is resolved once from the environment (a silent/console no-op by
 * default, Sentry when `NEXT_PUBLIC_SENTRY_DSN` is set) and can be swapped for
 * a spy in tests. No vendor SDK is imported unless a DSN is configured, so the
 * default path performs zero network work and the bundle/tests never require
 * `@sentry/nextjs`.
 */

/** Structured context attached to a captured error. */
export type ReportContext = Record<string, unknown>;

/** Low-cardinality dimensions attached to a metric increment. */
export type MetricTags = Record<string, string | number | boolean>;

export interface Reporter {
  /** Report an exception (handled or unhandled) with optional context. */
  captureError(error: unknown, context?: ReportContext): void;
  /** Increment a named counter metric with optional tags. */
  incrementMetric(name: string, tags?: MetricTags): void;
}

/** Flattened, serialisable shape a captured error is reduced to. */
export interface ErrorPayload extends ReportContext {
  name: string;
  message: string;
  status?: number;
  code?: string;
  category?: string;
  requestId?: string;
}

/**
 * Flatten any thrown value into a structured payload. An {@link ApiError}
 * contributes its `status`/`code`/`category`/`requestId` so FE reports
 * correlate 1:1 with `server_2` Pino logs via the request id.
 */
export function toErrorPayload(
  error: unknown,
  context: ReportContext = {},
): ErrorPayload {
  if (error instanceof ApiError) {
    return {
      ...context,
      name: error.name,
      message: error.message,
      status: error.status,
      code: error.code,
      category: error.category,
      requestId: error.requestId,
    };
  }
  if (error instanceof Error) {
    return { ...context, name: error.name, message: error.message };
  }
  return { ...context, name: "NonError", message: String(error) };
}

/**
 * Default reporter: silent in production, dev-console in development. Never
 * touches the network — it exists so reporting calls are always safe even
 * without a configured vendor.
 */
class ConsoleReporter implements Reporter {
  captureError(error: unknown, context?: ReportContext): void {
    if (process.env.NODE_ENV === "development") {
      console.error("[observability] captureError", toErrorPayload(error, context));
    }
  }

  incrementMetric(name: string, tags?: MetricTags): void {
    if (process.env.NODE_ENV === "development") {
      console.debug("[observability] metric", name, tags ?? {});
    }
  }
}

/** Minimal slice of `@sentry/nextjs` we rely on. */
interface SentryLike {
  init?: (options: { dsn: string; environment?: string }) => void;
  captureException(error: unknown, hint?: { extra?: ReportContext }): void;
  metrics?: {
    increment?: (name: string, value?: number, data?: { tags?: MetricTags }) => void;
  };
}

/**
 * Load and initialise `@sentry/nextjs` lazily with the given DSN. The specifier
 * is assembled at runtime so bundlers cannot statically resolve (and therefore
 * cannot fail to bundle) a dependency that may not be installed; any import or
 * init failure degrades to a no-op.
 */
function loadSentry(dsn: string): Promise<SentryLike | null> {
  const specifier = ["@sentry", "nextjs"].join("/");
  return import(/* webpackIgnore: true */ /* @vite-ignore */ specifier)
    .then((mod) => {
      const sentry = mod as unknown as SentryLike;
      sentry.init?.({ dsn, environment: process.env.NEXT_PUBLIC_SENTRY_ENV });
      return sentry;
    })
    .catch(() => null);
}

/**
 * Sentry-backed reporter, activated only when a DSN is present. The SDK is
 * imported + initialised on construction and every call awaits that load, so a
 * missing dependency or failed init silently degrades rather than throwing.
 */
class SentryReporter implements Reporter {
  private readonly sentry: Promise<SentryLike | null>;

  constructor(dsn: string) {
    this.sentry = loadSentry(dsn);
  }

  captureError(error: unknown, context?: ReportContext): void {
    void this.sentry.then((sentry) => {
      sentry?.captureException(error, { extra: toErrorPayload(error, context) });
    });
  }

  incrementMetric(name: string, tags?: MetricTags): void {
    void this.sentry.then((sentry) => {
      sentry?.metrics?.increment?.(name, 1, tags ? { tags } : undefined);
    });
  }
}

/**
 * Build the reporter implied by the environment. Sentry only when
 * `NEXT_PUBLIC_SENTRY_DSN` is set (statically accessed so Next can inline it);
 * otherwise the no-op console reporter.
 */
export function createDefaultReporter(): Reporter {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (dsn) {
    return new SentryReporter(dsn);
  }
  return new ConsoleReporter();
}

let active: Reporter | null = null;

/** The process-wide active reporter, lazily resolved from the environment. */
export function getReporter(): Reporter {
  if (active === null) {
    active = createDefaultReporter();
  }
  return active;
}

/** Swap the active reporter — used by tests to inject a spy. */
export function setReporter(reporter: Reporter): void {
  active = reporter;
}

/** Drop the active reporter so the next {@link getReporter} re-resolves it. */
export function resetReporter(): void {
  active = null;
}
