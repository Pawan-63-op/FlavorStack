import { MetricsSnapshot } from './metrics';

/**
 * Renders a `MetricsSnapshot` as Prometheus text exposition format (v0.0.4).
 *
 * Two deliberate choices:
 *
 * 1. **No `prom-client`.** The registry is a few dozen lines of counters and running
 *    aggregates; pulling in a client library to serialise them is not worth the dependency.
 *
 * 2. **Histograms are emitted as a summary, not a histogram.** A Prometheus histogram is
 *    defined by its `_bucket{le=...}` series, and `MetricsRegistry` has no bucket boundaries
 *    — it keeps only count/sum/min/max. Faking buckets would produce quantiles that are
 *    silently wrong, which is worse than not offering them, so each series emits
 *    `<name>_count` / `<name>_sum` (counters) plus `<name>_min` / `<name>_max` (gauges)
 *    and nothing else.
 *
 * `metricKey()` encodes labels as `name{k=v,k2=v2}` with sorted keys and unquoted values;
 * the exposition format requires quoted values, so the key is split back apart here.
 *
 * `gauges` carries point-in-time values computed at scrape time rather than accumulated in the
 * registry — the outbox backlog, which is a *cross-process* signal (see health.routes.ts).
 */
export function renderPrometheus(snap: MetricsSnapshot, gauges: Record<string, number> = {}): string {
  const lines: string[] = [];

  for (const [name, value] of Object.entries(gauges)) {
    const exposed = sanitizeName(name);
    lines.push(`# TYPE ${exposed} gauge`, `${exposed} ${value}`);
  }

  const counterGroups = groupByName(Object.keys(snap.counters));
  for (const [name, keys] of counterGroups) {
    lines.push(`# TYPE ${name} counter`);
    for (const key of keys) lines.push(`${sample(key)} ${snap.counters[key]}`);
  }

  const histogramGroups = groupByName(Object.keys(snap.histograms));
  for (const [name, keys] of histogramGroups) {
    for (const suffix of ['count', 'sum'] as const) {
      lines.push(`# TYPE ${name}_${suffix} counter`);
      for (const key of keys) lines.push(`${sample(key, `_${suffix}`)} ${snap.histograms[key][suffix]}`);
    }
    for (const suffix of ['min', 'max'] as const) {
      lines.push(`# TYPE ${name}_${suffix} gauge`);
      for (const key of keys) lines.push(`${sample(key, `_${suffix}`)} ${snap.histograms[key][suffix]}`);
    }
  }

  return lines.length === 0 ? '' : `${lines.join('\n')}\n`;
}

/**
 * Groups metric keys by their sanitized base name, preserving first-seen order.
 * Grouping on the *sanitized* name matters: two raw names that differ only in an illegal
 * character collapse to one exposed name, and a duplicate `# TYPE` line is a parse error.
 */
function groupByName(keys: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const key of keys) {
    const name = sanitizeName(splitKey(key).name);
    const existing = groups.get(name);
    if (existing) existing.push(key);
    else groups.set(name, [key]);
  }
  return groups;
}

/** `name{a=1,b=2}` + `_sum` → `name_sum{a="1",b="2"}`; a bare name emits no `{}`. */
function sample(key: string, nameSuffix = ''): string {
  const { name, labels } = splitKey(key);
  const rendered = `${sanitizeName(name)}${nameSuffix}`;
  if (labels.length === 0) return rendered;
  return `${rendered}{${labels.map(([k, v]) => `${sanitizeLabel(k)}="${escapeValue(v)}"`).join(',')}}`;
}

/**
 * Metric names must match `[a-zA-Z_:][a-zA-Z0-9_:]*`. Span-derived series are named after
 * dotted span names (`commerce.checkout` → `commerce.checkout_duration_ms`), and a single
 * illegal character makes the *entire* scrape unparseable — so the boundary sanitizes rather
 * than trusting its callers. The dotted spelling stays the internal convention in logs.
 */
function sanitizeName(name: string): string {
  const replaced = name.replace(/[^a-zA-Z0-9_:]/g, '_');
  return /^[a-zA-Z_:]/.test(replaced) ? replaced : `_${replaced}`;
}

/** Label names are the same, minus the colon. */
function sanitizeLabel(name: string): string {
  const replaced = name.replace(/[^a-zA-Z0-9_]/g, '_');
  return /^[a-zA-Z_]/.test(replaced) ? replaced : `_${replaced}`;
}

function splitKey(key: string): { name: string; labels: [string, string][] } {
  const brace = key.indexOf('{');
  if (brace === -1 || !key.endsWith('}')) return { name: key, labels: [] };

  const name = key.slice(0, brace);
  const body = key.slice(brace + 1, -1);
  if (body.length === 0) return { name, labels: [] };

  const labels = body.split(',').map((pair): [string, string] => {
    const eq = pair.indexOf('=');
    return eq === -1 ? [pair, ''] : [pair.slice(0, eq), pair.slice(eq + 1)];
  });
  return { name, labels };
}

/** Backslash, double quote and newline are the three characters the format escapes. */
function escapeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
