// PinoTelemetry (Commerce Phase 14, commerce_module.md §11) — the concrete ITelemetry the
// container injects. Structured logging rides the existing pino `logger`; metrics land in the
// in-process MetricsRegistry; spans log start/end with elapsed ms AND record a duration
// histogram so the checkout flow (load→ACL→price→persist→publish) is traceable.
import { ITelemetry, ISpan, LogFields, MetricLabels } from '../../application/shared/observability/ITelemetry';
import { logger } from './logger';
import { MetricsRegistry, metrics as defaultRegistry } from './metrics';
import type { Logger } from 'pino';

class PinoSpan implements ISpan {
  private readonly startedAt = Date.now();
  private settled = false;

  constructor(
    private readonly name: string,
    private readonly log: Logger,
    private readonly registry: MetricsRegistry,
    private readonly baseFields: LogFields
  ) {
    this.log.debug({ span: this.name, phase: 'start', ...this.baseFields }, `span:start ${this.name}`);
  }

  end(fields?: LogFields): number {
    return this.settle(true, undefined, fields);
  }

  fail(error?: unknown, fields?: LogFields): number {
    return this.settle(false, error, fields);
  }

  private settle(ok: boolean, error: unknown, fields?: LogFields): number {
    const elapsed = Date.now() - this.startedAt;
    if (this.settled) return elapsed;
    this.settled = true;

    this.registry.observe(`${this.name}_duration_ms`, elapsed, { ok });
    const merged: LogFields = { span: this.name, phase: 'end', ok, durationMs: elapsed, ...this.baseFields, ...fields };
    if (ok) {
      this.log.debug(merged, `span:end ${this.name}`);
    } else {
      this.log.warn({ ...merged, err: error }, `span:fail ${this.name}`);
    }
    return elapsed;
  }
}

export class PinoTelemetry implements ITelemetry {
  private readonly log: Logger;
  private readonly registry: MetricsRegistry;

  constructor(baseLogger: Logger = logger, registry: MetricsRegistry = defaultRegistry) {
    this.log = baseLogger;
    this.registry = registry;
  }

  debug(message: string, fields?: LogFields): void {
    this.log.debug(fields ?? {}, message);
  }
  info(message: string, fields?: LogFields): void {
    this.log.info(fields ?? {}, message);
  }
  warn(message: string, fields?: LogFields): void {
    this.log.warn(fields ?? {}, message);
  }
  error(message: string, fields?: LogFields): void {
    this.log.error(fields ?? {}, message);
  }

  increment(metric: string, labels?: MetricLabels, by = 1): void {
    this.registry.increment(metric, labels, by);
  }
  observe(metric: string, value: number, labels?: MetricLabels): void {
    this.registry.observe(metric, value, labels);
  }

  startSpan(name: string, fields?: LogFields): ISpan {
    return new PinoSpan(name, this.log, this.registry, fields ?? {});
  }
}
