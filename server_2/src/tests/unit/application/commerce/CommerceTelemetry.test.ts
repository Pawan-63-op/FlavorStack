// Commerce Phase 14 — CommerceTelemetry façade tests. Freezes the metric vocabulary (§11):
// each domain-named emitter must increment/observe the documented COMMERCE_METRICS name with
// the right labels, so the contract between use cases and dashboards can't silently drift.
import {
  CommerceTelemetry,
  COMMERCE_METRICS,
  COMMERCE_CHECKOUT_SPAN,
} from '../../../../application/commerce/observability/CommerceTelemetry';
import { RecordingTelemetry } from '../../../mocks/telemetry.mocks';

describe('CommerceTelemetry', () => {
  let rec: RecordingTelemetry;
  let telemetry: CommerceTelemetry;

  beforeEach(() => {
    rec = new RecordingTelemetry();
    telemetry = new CommerceTelemetry(rec);
  });

  it('cartAdded increments the cart-add counter and logs', () => {
    telemetry.cartAdded({ customerId: 'c1' });
    expect(rec.counter(COMMERCE_METRICS.cartAddTotal)).toBe(1);
    expect(rec.messages()).toContain('commerce.cart.item_added');
  });

  it('validationRejected counts per reason', () => {
    telemetry.validationRejected('ITEM_UNAVAILABLE');
    telemetry.validationRejected('ITEM_UNAVAILABLE');
    telemetry.validationRejected('RESTAURANT_CLOSED');
    expect(rec.counter(COMMERCE_METRICS.validationRejectionTotal, { reason: 'ITEM_UNAVAILABLE' })).toBe(2);
    expect(rec.counter(COMMERCE_METRICS.validationRejectionTotal, { reason: 'RESTAURANT_CLOSED' })).toBe(1);
  });

  it('recordPricingLatency observes the pricing histogram', () => {
    telemetry.recordPricingLatency(12);
    expect(rec.observed(COMMERCE_METRICS.pricingLatencyMs).map((o) => o.value)).toEqual([12]);
  });

  it('checkoutSucceeded / checkoutFailed track result label', () => {
    telemetry.checkoutSucceeded();
    telemetry.checkoutFailed('NOT_FOUND');
    expect(rec.counter(COMMERCE_METRICS.checkoutTotal, { result: 'success' })).toBe(1);
    expect(rec.counter(COMMERCE_METRICS.checkoutTotal, { result: 'failure' })).toBe(1);
    expect(rec.counter(COMMERCE_METRICS.checkoutFailureTotal, { reason: 'NOT_FOUND' })).toBe(1);
  });

  it('checkoutReplayed increments the idempotent-replay counter', () => {
    telemetry.checkoutReplayed();
    expect(rec.counter(COMMERCE_METRICS.checkoutIdempotentReplayTotal)).toBe(1);
  });

  it('orderRequestCreated logs an audit-tagged trail entry', () => {
    telemetry.orderRequestCreated({ orderRequestId: 'o1' });
    const log = rec.logs.find((l) => l.message === 'commerce.order_request.created');
    expect(log?.fields?.audit).toBe(true);
    expect(log?.fields?.orderRequestId).toBe('o1');
  });

  it('recordProjectionLag observes the projection-lag histogram', () => {
    telemetry.recordProjectionLag(250);
    expect(rec.observed(COMMERCE_METRICS.projectionLagMs).map((o) => o.value)).toEqual([250]);
  });

  it('startCheckoutSpan opens the documented checkout span', () => {
    telemetry.startCheckoutSpan({ customerId: 'c1' });
    expect(rec.spans[0].name).toBe(COMMERCE_CHECKOUT_SPAN);
  });

  it('defaults to a no-op telemetry when constructed without one', () => {
    expect(() => new CommerceTelemetry().cartAdded()).not.toThrow();
  });
});
