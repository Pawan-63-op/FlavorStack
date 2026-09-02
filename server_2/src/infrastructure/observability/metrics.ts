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

/**
 * Running aggregate for one histogram series. Deliberately *not* the raw observations:
 * a `number[]` grows without bound for the lifetime of the process, and every consumer
 * (`HistogramSnapshot`) only ever needs count/sum/min/max/avg — all foldable in O(1).
 */
interface HistogramState {
  count: number;
  sum: number;
  min: number;
  max: number;
}

export class MetricsRegistry {
  private readonly counters = new Map<string, number>();
  private readonly histograms = new Map<string, HistogramState>();

  increment(name: string, labels?: MetricLabels, by = 1): void {
    const key = metricKey(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + by);
  }

  observe(name: string, value: number, labels?: MetricLabels): void {
    const key = metricKey(name, labels);
    const state = this.histograms.get(key);
    if (!state) {
      this.histograms.set(key, { count: 1, sum: value, min: value, max: value });
      return;
    }
    state.count += 1;
    state.sum += value;
    if (value < state.min) state.min = value;
    if (value > state.max) state.max = value;
  }

  getCounter(name: string, labels?: MetricLabels): number {
    return this.counters.get(metricKey(name, labels)) ?? 0;
  }

  getHistogram(name: string, labels?: MetricLabels): HistogramSnapshot | undefined {
    const state = this.histograms.get(metricKey(name, labels));
    if (!state || state.count === 0) return undefined;
    return summarize(state);
  }

  snapshot(): MetricsSnapshot {
    const counters: Record<string, number> = {};
    for (const [k, v] of this.counters) counters[k] = v;
    const histograms: Record<string, HistogramSnapshot> = {};
    for (const [k, state] of this.histograms) histograms[k] = summarize(state);
    return { counters, histograms };
  }

  /** Drop all recorded series — primarily for test isolation. */
  reset(): void {
    this.counters.clear();
    this.histograms.clear();
  }
}

/** Pure projection of the running aggregate onto the public snapshot shape. */
function summarize(state: HistogramState): HistogramSnapshot {
  return { ...state, avg: state.sum / state.count };
}

/** Process-wide registry shared by the telemetry layer. */
export const metrics = new MetricsRegistry();
