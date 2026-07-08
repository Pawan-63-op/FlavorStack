import { MetricLabels } from '../../application/shared/observability/ITelemetry';

export interface HistogramSnapshot {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
}

export interface MetricsSnapshot {
  counters: Record<string, number>;
  histograms: Record<string, HistogramSnapshot>;
}

/** Stable key for a metric + its labels (labels sorted so ordering never matters). */
export function metricKey(name: string, labels?: MetricLabels): string {
  if (!labels || Object.keys(labels).length === 0) return name;
  const parts = Object.keys(labels)
    .sort()
    .map((k) => `${k}=${String(labels[k])}`);
  return `${name}{${parts.join(',')}}`;
}

export class MetricsRegistry {
  private readonly counters = new Map<string, number>();
  private readonly histograms = new Map<string, number[]>();

  increment(name: string, labels?: MetricLabels, by = 1): void {
    const key = metricKey(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + by);
  }

  observe(name: string, value: number, labels?: MetricLabels): void {
    const key = metricKey(name, labels);
    const series = this.histograms.get(key);
    if (series) series.push(value);
    else this.histograms.set(key, [value]);
  }

  getCounter(name: string, labels?: MetricLabels): number {
    return this.counters.get(metricKey(name, labels)) ?? 0;
  }

  getHistogram(name: string, labels?: MetricLabels): HistogramSnapshot | undefined {
    const series = this.histograms.get(metricKey(name, labels));
    if (!series || series.length === 0) return undefined;
    return summarize(series);
  }

  snapshot(): MetricsSnapshot {
    const counters: Record<string, number> = {};
    for (const [k, v] of this.counters) counters[k] = v;
    const histograms: Record<string, HistogramSnapshot> = {};
    for (const [k, series] of this.histograms) histograms[k] = summarize(series);
    return { counters, histograms };
  }

  /** Drop all recorded series — primarily for test isolation. */
  reset(): void {
    this.counters.clear();
    this.histograms.clear();
  }
}

function summarize(series: number[]): HistogramSnapshot {
  let sum = 0;
  let min = series[0];
  let max = series[0];
  for (const v of series) {
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { count: series.length, sum, min, max, avg: sum / series.length };
}

/** Process-wide registry shared by the telemetry layer. */
export const metrics = new MetricsRegistry();
