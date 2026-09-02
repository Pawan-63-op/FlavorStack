import { ITelemetry, ISpan, LogFields } from '../../shared/observability/ITelemetry';
import { NoopTelemetry } from '../../shared/observability/NoopTelemetry';

/** The complete Commerce metric vocabulary (commerce_module.md §11). Single source of truth. */
export const COMMERCE_METRICS = {
  /** Counter — cart-add rate. */
  cartAddTotal: 'commerce_cart_add_total',
  /** Counter{result=success|failure} — checkout outcomes. */
  checkoutTotal: 'commerce_checkout_total',
  /** Counter{reason} — checkout failure reasons (error code). */
  checkoutFailureTotal: 'commerce_checkout_failure_total',
  /** Counter — idempotent checkout replays (same Idempotency-Key returned the original). */
  checkoutIdempotentReplayTotal: 'commerce_checkout_idempotent_replay_total',
  /** Histogram(ms) — pricing pipeline latency. */
  pricingLatencyMs: 'commerce_pricing_latency_ms',
  /** Counter{reason} — cart validation rejection reasons. */
  validationRejectionTotal: 'commerce_validation_rejection_total',
  /**
   * Counter — domain events durably handed to the relay by Checkout's outbox append.
   * Deliberately separate from `checkoutTotal{result=success}`: "orders accepted" and
   * "orders handed to the relay" diverging is *precisely* the failure the outbox exists to
   * make visible, and a single counter cannot show it.
   */
  outboxAppendTotal: 'commerce_outbox_append_total',
} as const;

export type CommerceMetricName = (typeof COMMERCE_METRICS)[keyof typeof COMMERCE_METRICS];

/** Span name for the committing checkout flow (load→ACL→price→persist→publish). */
export const COMMERCE_CHECKOUT_SPAN = 'commerce.checkout';

export class CommerceTelemetry {
  constructor(private readonly t: ITelemetry = new NoopTelemetry()) {}

  cartAdded(fields?: LogFields): void {
    this.t.increment(COMMERCE_METRICS.cartAddTotal);
    this.t.info('commerce.cart.item_added', fields);
  }

  validationRejected(reason: string, fields?: LogFields): void {
    this.t.increment(COMMERCE_METRICS.validationRejectionTotal, { reason });
    this.t.debug('commerce.cart.validation_rejected', { reason, ...fields });
  }

  recordPricingLatency(ms: number, fields?: LogFields): void {
    this.t.observe(COMMERCE_METRICS.pricingLatencyMs, ms);
    if (fields) this.t.debug('commerce.pricing.calculated', { durationMs: ms, ...fields });
  }

  startCheckoutSpan(fields?: LogFields): ISpan {
    return this.t.startSpan(COMMERCE_CHECKOUT_SPAN, fields);
  }

  checkoutSucceeded(fields?: LogFields): void {
    this.t.increment(COMMERCE_METRICS.checkoutTotal, { result: 'success' });
    this.t.info('commerce.checkout.succeeded', fields);
  }

  checkoutFailed(reason: string, fields?: LogFields): void {
    this.t.increment(COMMERCE_METRICS.checkoutTotal, { result: 'failure' });
    this.t.increment(COMMERCE_METRICS.checkoutFailureTotal, { reason });
    this.t.warn('commerce.checkout.failed', { reason, ...fields });
  }

  checkoutReplayed(fields?: LogFields): void {
    this.t.increment(COMMERCE_METRICS.checkoutIdempotentReplayTotal);
    this.t.info('commerce.checkout.idempotent_replay', fields);
  }

  /**
   * Records that `count` events were committed to the outbox alongside the OrderRequest.
   * Called only *after* the transaction commits, so it counts durable handoffs — a commit
   * that appended nothing increments by zero, which is the divergence worth alerting on.
   */
  outboxAppended(count: number, fields?: LogFields): void {
    this.t.increment(COMMERCE_METRICS.outboxAppendTotal, undefined, count);
    this.t.debug('commerce.checkout.outbox_appended', { count, ...fields });
  }

  /**
   * Audit record for a created OrderRequest. The OrderRequest itself is the immutable,
   * self-contained audit artifact (§11); this emits a structured, correlatable trail entry.
   */
  orderRequestCreated(fields: LogFields): void {
    this.t.info('commerce.order_request.created', { audit: true, ...fields });
  }
}
