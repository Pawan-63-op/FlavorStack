import { MetricsRegistry, metricKey } from '../../../../infrastructure/observability/metrics';

describe('metricKey', () => {
  it('returns the bare name when there are no labels', () => {
    expect(metricKey('m')).toBe('m');
    expect(metricKey('m', {})).toBe('m');
  });

  it('folds labels deterministically regardless of key order', () => {
    expect(metricKey('m', { b: 2, a: 1 })).toBe('m{a=1,b=2}');
    expect(metricKey('m', { a: 1, b: 2 })).toBe('m{a=1,b=2}');
  });
});

describe('MetricsRegistry', () => {
  let registry: MetricsRegistry;
  beforeEach(() => {
    registry = new MetricsRegistry();
  });

  it('increments counters and tracks labelled series independently', () => {
    registry.increment('checkout', { result: 'success' });
    registry.increment('checkout', { result: 'success' });
    registry.increment('checkout', { result: 'failure' });

    expect(registry.getCounter('checkout', { result: 'success' })).toBe(2);
    expect(registry.getCounter('checkout', { result: 'failure' })).toBe(1);
    expect(registry.getCounter('checkout', { result: 'unknown' })).toBe(0);
  });

  it('supports a custom increment amount', () => {
    registry.increment('bytes', undefined, 5);
    registry.increment('bytes', undefined, 3);
    expect(registry.getCounter('bytes')).toBe(8);
  });

  it('summarizes histogram observations', () => {
    registry.observe('latency', 10);
    registry.observe('latency', 20);
    registry.observe('latency', 30);

    const h = registry.getHistogram('latency');
    expect(h).toEqual({ count: 3, sum: 60, min: 10, max: 30, avg: 20 });
  });

  it('keeps histogram memory flat as observations accumulate', () => {
    // Regression guard for the Phase 9 swap from `number[]` to a running aggregate:
    // observations must fold in place, never accumulate one entry per call.
    for (let i = 0; i < 10_000; i++) registry.observe('latency', i, { route: 'checkout' });

    expect(Object.keys(registry.snapshot().histograms)).toEqual(['latency{route=checkout}']);
    expect(registry.getHistogram('latency', { route: 'checkout' })).toEqual({
      count: 10_000,
      sum: (9999 * 10_000) / 2,
      min: 0,
      max: 9999,
      avg: 9999 / 2,
    });
  });

  it('returns undefined for an unseen histogram', () => {
    expect(registry.getHistogram('nope')).toBeUndefined();
  });

  it('snapshots all counters and histograms', () => {
    registry.increment('c', { k: 'v' });
    registry.observe('h', 7);
    const snap = registry.snapshot();
    expect(snap.counters['c{k=v}']).toBe(1);
    expect(snap.histograms['h'].avg).toBe(7);
  });

  it('reset clears everything', () => {
    registry.increment('c');
    registry.observe('h', 1);
    registry.reset();
    expect(registry.getCounter('c')).toBe(0);
    expect(registry.getHistogram('h')).toBeUndefined();
  });
});
