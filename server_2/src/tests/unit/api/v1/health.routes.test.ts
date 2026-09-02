import express, { Express } from 'express';
import request from 'supertest';
import { createHealthRoutes, OutboxBacklogReader } from '../../../../api/v1/routes/health.routes';
import { metrics } from '../../../../infrastructure/observability/metrics';

function buildApp(readOutboxBacklog?: OutboxBacklogReader): Express {
  const app = express();
  app.use(
    createHealthRoutes({
      // `/metrics` never touches these; `/health` has its own coverage in app.test.ts.
      connection: { db: { admin: () => ({ command: jest.fn() }) } } as never,
      redisClient: { ping: jest.fn().mockResolvedValue(true) } as never,
      readOutboxBacklog,
    })
  );
  return app;
}

const backlog = (over: Partial<{ pending: number; processing: number; oldestPendingAgeSeconds: number }> = {}) =>
  jest.fn().mockResolvedValue({ pending: 0, processing: 0, oldestPendingAgeSeconds: 0, ...over });

describe('GET /metrics — outbox backlog gauges', () => {
  beforeEach(() => {
    metrics.reset();
  });
  afterAll(() => {
    metrics.reset();
  });

  it('emits the three backlog gauges from the scrape-time source', async () => {
    const app = buildApp(backlog({ pending: 3, processing: 1, oldestPendingAgeSeconds: 42 }));

    const res = await request(app).get('/metrics');

    expect(res.status).toBe(200);
    const lines = res.text.split('\n');
    expect(lines).toContain('# TYPE flavorstack_outbox_pending gauge');
    expect(lines).toContain('flavorstack_outbox_pending 3');
    expect(lines).toContain('flavorstack_outbox_processing 1');
    expect(lines).toContain('flavorstack_outbox_oldest_pending_age_seconds 42');
  });

  it('reads the backlog fresh on every scrape', async () => {
    const read = backlog({ pending: 1 });
    const app = buildApp(read);

    await request(app).get('/metrics');
    await request(app).get('/metrics');

    expect(read).toHaveBeenCalledTimes(2);
  });

  it('degrades to the in-memory registry when the backlog source throws', async () => {
    // Losing three gauges is recoverable; losing every metric in the process is not.
    metrics.increment('commerce_checkout_total', { result: 'success' });
    metrics.observe('commerce_pricing_latency_ms', 12);
    const app = buildApp(jest.fn().mockRejectedValue(new Error('mongo down')));

    const res = await request(app).get('/metrics');

    expect(res.status).toBe(200);
    const lines = res.text.split('\n');
    expect(lines).toContain('commerce_checkout_total{result="success"} 1');
    expect(lines).toContain('commerce_pricing_latency_ms_sum 12');
    expect(res.text).not.toContain('flavorstack_outbox');
  });

  it('emits gauges alongside the registry sections, not instead of them', async () => {
    metrics.increment('commerce_cart_add_total');
    const app = buildApp(backlog({ pending: 5 }));

    const res = await request(app).get('/metrics');

    expect(res.text).toContain('flavorstack_outbox_pending 5');
    expect(res.text).toContain('commerce_cart_add_total 1');
  });
});
