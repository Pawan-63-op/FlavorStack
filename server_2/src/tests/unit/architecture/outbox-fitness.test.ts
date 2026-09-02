import { readFileSync, readdirSync } from 'fs';
import { join, relative, sep } from 'path';

/**
 * Phase 7 fitness test.
 *
 * The outbox exists for exactly one message: `OrderRequested`, appended by `Checkout`. That is
 * the single durable async edge in the system (Commerce → Fulfillment) — checkout has committed
 * and the customer has been charged, so losing it means the order silently never reaches the
 * restaurant. Every other cross-context reaction is in-process, best-effort, and recoverable by
 * retrying the user action.
 *
 * Before Phase 7, 45 use cases wrote to the outbox *and* published the same events inline, so
 * every outboxed event was delivered twice. These assertions are what stop that re-spreading:
 * a new `outboxStore.append` anywhere else fails the suite rather than quietly reintroducing
 * double delivery.
 */

const APPLICATION_ROOT = join(__dirname, '..', '..', '..', 'application');
const CHECKOUT = ['commerce', 'use-cases', 'Checkout.ts'].join(sep);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && entry.name.endsWith('.ts') ? [full] : [];
  });
}

describe('outbox fitness: the outbox has exactly one writer', () => {
  const files = walk(APPLICATION_ROOT);

  it('finds the application layer (guards against a silently empty sweep)', () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files.some((f) => f.endsWith(CHECKOUT))).toBe(true);
  });

  it('appends to the outbox only from Checkout', () => {
    const appenders = files
      .filter((f) => readFileSync(f, 'utf8').includes('outboxStore.append'))
      .map((f) => relative(APPLICATION_ROOT, f));

    expect(appenders).toEqual([CHECKOUT]);
  });

  it('injects IOutboxStore only into Checkout', () => {
    const injectors = files
      .filter((f) => f !== join(APPLICATION_ROOT, 'shared', 'outbox', 'IOutboxStore.ts'))
      .filter((f) => /outboxStore: IOutboxStore/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(APPLICATION_ROOT, f));

    expect(injectors).toEqual([CHECKOUT]);
  });

  it('keeps Checkout free of an inline publish for the event it outboxes', () => {
    const checkout = readFileSync(join(APPLICATION_ROOT, CHECKOUT), 'utf8');

    expect(checkout).toContain('outboxStore.append');
    expect(checkout).not.toMatch(/eventBus\.publish/);
  });
});
