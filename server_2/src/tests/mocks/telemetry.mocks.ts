import { ITelemetry, ISpan, LogFields, MetricLabels } from '../../application/shared/observability/ITelemetry';
import { metricKey } from '../../infrastructure/observability/metrics';

export interface RecordedLog {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  fields?: LogFields;
}

export interface RecordedObservation {
  metric: string;
  value: number;
  labels?: MetricLabels;
}

export interface RecordedSpan {
  name: string;
  fields?: LogFields;
  outcome: 'open' | 'ended' | 'failed';
  endFields?: LogFields;
}

export class RecordingTelemetry implements ITelemetry {
  readonly logs: RecordedLog[] = [];
  readonly counters = new Map<string, number>();
  readonly observations: RecordedObservation[] = [];
  readonly spans: RecordedSpan[] = [];

  debug(message: string, fields?: LogFields): void {
    this.logs.push({ level: 'debug', message, fields });
  }
  info(message: string, fields?: LogFields): void {
    this.logs.push({ level: 'info', message, fields });
  }
  warn(message: string, fields?: LogFields): void {
    this.logs.push({ level: 'warn', message, fields });
  }
  error(message: string, fields?: LogFields): void {
    this.logs.push({ level: 'error', message, fields });
  }

  increment(metric: string, labels?: MetricLabels, by = 1): void {
    const key = metricKey(metric, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + by);
  }
  observe(metric: string, value: number, labels?: MetricLabels): void {
    this.observations.push({ metric, value, labels });
  }

  startSpan(name: string, fields?: LogFields): ISpan {
    const record: RecordedSpan = { name, fields, outcome: 'open' };
    this.spans.push(record);
    return {
      end: (endFields?: LogFields) => {
        record.outcome = 'ended';
        record.endFields = endFields;
        return 0;
      },
      fail: (_error?: unknown, endFields?: LogFields) => {
        record.outcome = 'failed';
        record.endFields = endFields;
        return 0;
      },
    };
  }

  counter(metric: string, labels?: MetricLabels): number {
    return this.counters.get(metricKey(metric, labels)) ?? 0;
  }
  observed(metric: string): RecordedObservation[] {
    return this.observations.filter((o) => o.metric === metric);
  }
  messages(): string[] {
    return this.logs.map((l) => l.message);
  }
}
