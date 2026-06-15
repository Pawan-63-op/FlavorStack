// No-op telemetry (Commerce Phase 14) — the safe default injected when a use case is
// constructed without an explicit telemetry dependency (e.g. in unit tests that don't
// assert on observability). Every method is a harmless no-op; spans return 0 elapsed ms.
import { ITelemetry, ISpan, LogFields, MetricLabels } from './ITelemetry';

const NOOP_SPAN: ISpan = {
  end: () => 0,
  fail: () => 0,
};

export class NoopTelemetry implements ITelemetry {
  debug(_message: string, _fields?: LogFields): void {}
  info(_message: string, _fields?: LogFields): void {}
  warn(_message: string, _fields?: LogFields): void {}
  error(_message: string, _fields?: LogFields): void {}
  increment(_metric: string, _labels?: MetricLabels, _by?: number): void {}
  observe(_metric: string, _value: number, _labels?: MetricLabels): void {}
  startSpan(_name: string, _fields?: LogFields): ISpan {
    return NOOP_SPAN;
  }
}
