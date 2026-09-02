import { readFileSync, readdirSync } from 'fs';
import { join, relative, sep } from 'path';
import { QUEUE } from '../../../config/bullmq';

/**
 * Phase 8 fitness test.
 *
 * Phase 8 collapsed the runtime topology to what the work actually is: **two queues**
 * (`email-queue`, `fulfillment-queue`) and **two processes** (`relay`, `jobs`). Before it there
 * were three queues — the third, `dead-letter-queue`, had three producers and no consumer — and
 * three worker containers, each calling the full `bootstrap()`: all eight context containers, the
 * 31 identity use cases, and `runSeeds` racing itself three ways.
 *
 * These assertions are what stop that re-spreading. The last one is the important one: a worker
 * that imports `bootstrap` instead of `bootstrapWorker` silently re-acquires the entire graph and
 * re-enters the seed race, and nothing else in the suite would notice.
 */

const SRC_ROOT = join(__dirname, '..', '..', '..');
const WORKERS_ROOT = join(SRC_ROOT, 'workers');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && entry.name.endsWith('.ts') ? [full] : [];
  });
}

/** Every non-test `.ts` file under `src/`. */
function productionSources(): string[] {
  return walk(SRC_ROOT).filter((f) => !relative(SRC_ROOT, f).startsWith(`tests${sep}`));
}

describe('worker fitness: two queues, two processes', () => {
  const sources = productionSources();
  const workerFiles = walk(WORKERS_ROOT).map((f) => relative(WORKERS_ROOT, f));
  const indexSource = readFileSync(join(WORKERS_ROOT, 'index.ts'), 'utf8');

  it('finds the source tree (guards against a silently empty sweep)', () => {
    expect(sources.length).toBeGreaterThan(200);
    expect(workerFiles.length).toBeGreaterThan(0);
  });

  it('has exactly the two entrypoints, their selector, and the shared lifecycle', () => {
    expect(workerFiles.sort()).toEqual(
      ['index.ts', 'jobs.worker.ts', 'relay.worker.ts', ['shared', 'runWorker.ts'].join(sep)].sort(),
    );
  });

  it('registers exactly the relay and jobs runners', () => {
    // Non-greedy past the `Record<string, () => Promise<void>>` annotation, whose `=>` would
    // otherwise be mistaken for the assignment.
    const block = indexSource.match(/const RUNNERS[\s\S]*?=\s*\{([^}]*)\}/);
    expect(block).not.toBeNull();

    const keys = [...(block as RegExpMatchArray)[1].matchAll(/^\s*(\w+)\s*:/gm)].map((m) => m[1]);

    expect(keys).toEqual(['relay', 'jobs']);
  });

  it('defines exactly two queues', () => {
    expect(QUEUE).toEqual({ email: 'email-queue', fulfillment: 'fulfillment-queue' });
  });

  it('opens no BullMQ Queue or Worker on a name outside QUEUE', () => {
    const constructions = sources.flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/new (?:Queue|Worker)(?:<[^>]*>)?\(\s*([^,)\s]+)/g)].map(
        (m) => ({ file: relative(SRC_ROOT, file), name: m[1] }),
      ),
    );

    // The sweep must actually be finding the constructions it claims to police.
    expect(constructions.length).toBeGreaterThanOrEqual(4);

    const queueRefs = Object.keys(QUEUE).map((k) => `QUEUE.${k}`);
    expect(constructions.filter((c) => !queueRefs.includes(c.name))).toEqual([]);
  });

  it('never lets a worker import the full `bootstrap`', () => {
    // `bootstrap()` builds all eight context containers, the 31 identity use cases and runs
    // `runSeeds`. A worker reaching for it is the exact regression this phase removed.
    const offenders = walk(WORKERS_ROOT).filter((file) => {
      const named = [...readFileSync(file, 'utf8').matchAll(/import\s*\{([^}]*)\}\s*from/g)].flatMap(
        (m) => m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0].trim()),
      );
      return named.includes('bootstrap');
    });

    expect(offenders.map((f) => relative(WORKERS_ROOT, f))).toEqual([]);
  });
});
