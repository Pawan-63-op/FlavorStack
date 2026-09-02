import { MetricsRegistry } from '../../../../infrastructure/observability/metrics';
import { renderPrometheus } from '../../../../infrastructure/observability/prometheus';

function render(build: (r: MetricsRegistry) => void): string[] {
  const registry = new MetricsRegistry();
  build(registry);
  return renderPrometheus(registry.snapshot()).split('\n').filter(Boolean);
}

describe('renderPrometheus', () => {
  it('renders an unlabelled counter with no empty brace pair', () => {
    const lines = render((r) => r.increment('commerce_checkout_total', undefined, 3));

    expect(lines).toEqual(['# TYPE commerce_checkout_total counter', 'commerce_checkout_total 3']);
  });

  it('quotes label values, which the metricKey encoding does not', () => {
    const lines = render((r) => {
      r.increment('commerce_checkout_total', { result: 'success' });
      r.increment('commerce_checkout_total', { result: 'failure' }, 2);
    });

    expect(lines).toEqual([
      '# TYPE commerce_checkout_total counter',
      'commerce_checkout_total{result="success"} 1',
      'commerce_checkout_total{result="failure"} 2',
    ]);
  });

  it('emits one TYPE line per metric name, not per label set', () => {
    const lines = render((r) => {
      r.increment('c', { a: '1' });
      r.increment('c', { a: '2' });
    });

    expect(lines.filter((l) => l.startsWith('# TYPE'))).toEqual(['# TYPE c counter']);
  });

  it('renders a labelled histogram as a summary — count/sum plus min/max gauges', () => {
    const lines = render((r) => {
      r.observe('commerce_checkout_ms', 10, { result: 'success' });
      r.observe('commerce_checkout_ms', 30, { result: 'success' });
    });

    expect(lines).toEqual([
      '# TYPE commerce_checkout_ms_count counter',
      'commerce_checkout_ms_count{result="success"} 2',
      '# TYPE commerce_checkout_ms_sum counter',
      'commerce_checkout_ms_sum{result="success"} 40',
      '# TYPE commerce_checkout_ms_min gauge',
      'commerce_checkout_ms_min{result="success"} 10',
      '# TYPE commerce_checkout_ms_max gauge',
      'commerce_checkout_ms_max{result="success"} 30',
    ]);
  });

  it('never fakes a bucketed histogram — the registry has no bucket boundaries', () => {
    const lines = render((r) => r.observe('h', 1));

    expect(lines.some((l) => l.includes('_bucket'))).toBe(false);
    expect(lines.some((l) => l.includes('le='))).toBe(false);
  });

  it('folds multiple label keys in the sorted order metricKey produced', () => {
    const lines = render((r) => r.increment('c', { b: 2, a: 1 }));

    expect(lines).toContain('c{a="1",b="2"} 1');
  });

  it('escapes backslashes and quotes in label values', () => {
    const lines = render((r) => r.increment('c', { path: 'a\\b"c' }));

    expect(lines).toContain('c{path="a\\\\b\\"c"} 1');
  });

  it('sanitizes dotted span-derived names into legal metric names', () => {
    // PinoSpan names its histogram `${spanName}_duration_ms`, and span names are dotted
    // (`commerce.checkout`). A dot is illegal in a metric name and makes the WHOLE scrape
    // unparseable, so the renderer must not pass it through.
    const lines = render((r) => r.observe('commerce.checkout_duration_ms', 71, { ok: true }));

    expect(lines).toContain('# TYPE commerce_checkout_duration_ms_count counter');
    expect(lines).toContain('commerce_checkout_duration_ms_count{ok="true"} 1');
    expect(lines.some((l) => l.includes('.'))).toBe(false);
  });

  it('emits one TYPE line when two raw names sanitize to the same exposed name', () => {
    const lines = render((r) => {
      r.increment('a.b');
      r.increment('a-b');
    });

    expect(lines.filter((l) => l.startsWith('# TYPE'))).toEqual(['# TYPE a_b counter']);
  });

  it('prefixes a name that would otherwise start with a digit', () => {
    const lines = render((r) => r.increment('5xx_total'));

    expect(lines).toContain('_5xx_total 1');
  });

  it('renders an empty snapshot as an empty string', () => {
    expect(renderPrometheus({ counters: {}, histograms: {} })).toBe('');
  });
});
