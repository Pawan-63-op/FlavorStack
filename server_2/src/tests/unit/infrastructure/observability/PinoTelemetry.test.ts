import pino from 'pino';
import { PinoTelemetry } from '../../../../infrastructure/observability/PinoTelemetry';
import { MetricsRegistry } from '../../../../infrastructure/observability/metrics';

function silentLogger() {
  return pino({ level: 'silent' });
}

describe('PinoTelemetry', () => {
  let registry: MetricsRegistry;
  let telemetry: PinoTelemetry;

  beforeEach(() => {
    registry = new MetricsRegistry();
    telemetry = new PinoTelemetry(silentLogger(), registry);
  });

  it('delegates counter increments to the registry', () => {
    telemetry.increment('m', { a: 'b' }, 2);
    expect(registry.getCounter('m', { a: 'b' })).toBe(2);
  });

  it('delegates histogram observations to the registry', () => {
    telemetry.observe('lat', 42);
    expect(registry.getHistogram('lat')?.sum).toBe(42);
  });

  it('records a duration observation when a span ends', () => {
    const span = telemetry.startSpan('commerce.checkout', { customerId: 'c1' });
    const elapsed = span.end({ ok: true });
    expect(elapsed).toBeGreaterThanOrEqual(0);
    const h = registry.getHistogram('commerce.checkout_duration_ms', { ok: true });
    expect(h?.count).toBe(1);
  });

  it('records a failed-duration observation when a span fails', () => {
    const span = telemetry.startSpan('commerce.checkout');
    span.fail(new Error('boom'), { reason: 'NOT_FOUND' });
    const h = registry.getHistogram('commerce.checkout_duration_ms', { ok: false });
    expect(h?.count).toBe(1);
  });

  it('is idempotent — settling a span twice records one observation', () => {
    const span = telemetry.startSpan('s');
    span.end();
    span.end();
    expect(registry.getHistogram('s_duration_ms', { ok: true })?.count).toBe(1);
  });

  it('logging methods do not throw', () => {
    expect(() => {
      telemetry.debug('d', { x: 1 });
      telemetry.info('i');
      telemetry.warn('w', { y: 2 });
      telemetry.error('e', { err: new Error('x') });
    }).not.toThrow();
  });
});
