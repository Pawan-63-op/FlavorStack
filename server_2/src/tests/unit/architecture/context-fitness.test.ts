import { readFileSync, readdirSync } from 'fs';
import { join, relative, resolve, dirname, sep } from 'path';
import { TRACKING_STATUS_EVENTS } from '../../../application/fulfillment/event-handlers/TrackingStatusBridge';

/**
 * Phase 9 fitness test — the two context invariants the simplification relied on but never locked
 * in. `outbox-fitness.test.ts` guards the single outbox writer and `worker-fitness.test.ts` guards
 * the two-queue/two-process topology; this file guards the context boundaries themselves.
 *
 * Same hand-rolled `fs` + regex style as its two siblings, and for the same reason: an AST tool
 * (`ts-morph`, `dependency-cruiser`) is a dependency this repo does not carry and does not need for
 * a sweep this shallow. Each `describe` opens with a "guards against a silently empty sweep" case,
 * because a fitness test whose sweep finds nothing passes for the wrong reason forever.
 */

const SRC_ROOT = join(__dirname, '..', '..', '..');
const CONTEXTS = ['catalog', 'commerce', 'engagement', 'fulfillment', 'identity'] as const;

/** Compare paths as posix regardless of platform, so the assertions read the same everywhere. */
function posix(p: string): string {
  return p.split(sep).join('/');
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && entry.name.endsWith('.ts') ? [full] : [];
  });
}

/** Every non-test `.ts` file under `src/application/` and `src/domain/` that belongs to a context. */
function contextSources(): { file: string; context: string; source: string }[] {
  return ['application', 'domain'].flatMap((layer) =>
    CONTEXTS.flatMap((context) =>
      walk(join(SRC_ROOT, layer, context)).map((file) => ({
        file: posix(relative(SRC_ROOT, file)),
        context,
        source: readFileSync(file, 'utf8'),
      })),
    ),
  );
}

/** Every relative `from '...'` specifier in a file, resolved to a `src/`-relative module path. */
function relativeImports(file: string, source: string): string[] {
  return [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)]
    .map((m) => m[1])
    .filter((spec) => spec.startsWith('.'))
    .map((spec) => posix(relative(SRC_ROOT, resolve(join(SRC_ROOT, dirname(file)), spec))));
}

describe('context fitness: no context reaches into another', () => {
  const sources = contextSources();

  it('finds the context sources (guards against a silently empty sweep)', () => {
    expect(sources.length).toBeGreaterThan(300);
    for (const context of CONTEXTS) {
      expect(sources.filter((s) => s.context === context).length).toBeGreaterThan(0);
    }
    // The sweep must actually be reading imports, not empty files.
    expect(sources.filter((s) => relativeImports(s.file, s.source).length > 0).length).toBeGreaterThan(200);
  });

  it('never imports a Mongo model from the application or domain layer', () => {
    // Models are infrastructure. A use case or entity that reaches for one has bypassed the
    // repository port, which is what makes a context's storage private to it in the first place.
    const offenders = sources.flatMap(({ file, source }) =>
      relativeImports(file, source)
        .filter((mod) => mod.includes('infrastructure/database/models/'))
        .map((mod) => `${file} -> ${mod}`),
    );

    expect(offenders).toEqual([]);
  });

  it('never imports another context, outside the two shared-kernel value objects', () => {
    /**
     * The allowlist, and why it is exactly these two.
     *
     * `Address` and `GeoPoint` are a de-facto **shared kernel**: a postal address and a lat/lng
     * pair mean the same thing in every context, and every context needs both (catalog for
     * delivery zones, commerce for the checkout address, fulfillment for the drop point). They
     * happen to live under `domain/identity/` for historical reasons — that is a naming wart, not
     * a coupling, and moving them to `domain/shared/` is a production-code change this batch does
     * not make.
     *
     * Everything else is forbidden. Cross-context *reads* go through a port the **consuming**
     * context owns and the container resolves — `domain/commerce/services/ICatalogGateway`,
     * `domain/engagement/services/IFulfillmentGateway` — which is why neither of those shows up
     * here: they are same-context imports by construction. That is the whole shape of the escape
     * hatch. Adding a third entry to this list is a design decision, not a fix.
     */
    const SHARED_KERNEL = [
      'domain/identity/value-objects/Address.vo',
      'domain/identity/value-objects/GeoPoint.vo',
    ];

    const offenders = sources.flatMap(({ file, context, source }) =>
      relativeImports(file, source)
        .filter((mod) => {
          const [layer, owner] = mod.split('/');
          if (layer !== 'application' && layer !== 'domain') return false;
          if (!(CONTEXTS as readonly string[]).includes(owner)) return false;
          return owner !== context && !SHARED_KERNEL.includes(mod);
        })
        .map((mod) => `${file} -> ${mod}`),
    );

    // Printed in full on failure: the offending edge is the whole diagnosis.
    expect(offenders).toEqual([]);
  });
});

describe('context fitness: every domain event has a delivery path', () => {
  /**
   * `OrderRequested` is the one event with no bus subscriber, and that is deliberate. Phase 7.3
   * made the outbox relay its **sole** delivery path (`OutboxProcessor` → `OutboxDispatcher` →
   * `OnOrderRequested`); subscribing it on the in-process bus as well would restore the double
   * delivery that phase removed. The third assertion below is what stops this from being a free
   * pass — the event still has to be routed somewhere.
   */
  const OUTBOX_DELIVERED = ['OrderRequested'];

  /** Event names declared by the classes under `domain/<context>/events/`. */
  function declaredEvents(): string[] {
    return CONTEXTS.flatMap((context) => {
      const dir = join(SRC_ROOT, 'domain', context, 'events');
      let files: string[];
      try {
        files = walk(dir);
      } catch {
        return []; // engagement declares no events of its own; it only subscribes.
      }
      return files.flatMap((file) => {
        const match = readFileSync(file, 'utf8').match(/readonly eventName\s*=\s*['"]([A-Za-z]+)['"]/);
        return match ? [match[1]] : [];
      });
    });
  }

  /**
   * Event names passed to `eventBus.subscribe`, in all three forms the registries use:
   * a string literal, a `for (const name of [...])` loop over literals, and the exported
   * `TRACKING_STATUS_EVENTS` constant — imported rather than regexed, since it is derived from
   * `EVENT_TO_STATUS`'s keys and a regex would silently miss a new entry.
   */
  function subscribedEvents(): string[] {
    const registries = walk(join(SRC_ROOT, 'application')).filter((f) =>
      readFileSync(f, 'utf8').includes('.subscribe('),
    );

    const names = registries.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      const direct = [...source.matchAll(/\.subscribe\(\s*['"]([A-Za-z]+)['"]/g)].map((m) => m[1]);
      const looped = [...source.matchAll(/for\s*\(\s*const\s+\w+\s+of\s+\[([\s\S]*?)\]/g)].flatMap((m) =>
        [...m[1].matchAll(/['"]([A-Za-z]+)['"]/g)].map((s) => s[1]),
      );
      return [...direct, ...looped];
    });

    return [...names, ...TRACKING_STATUS_EVENTS];
  }

  const declared = [...new Set(declaredEvents())].sort();
  const subscribed = [...new Set(subscribedEvents())].sort();

  it('finds the events and the registries (guards against a silently empty sweep)', () => {
    expect(declared.length).toBeGreaterThanOrEqual(20);
    expect(subscribed.length).toBeGreaterThanOrEqual(20);
    expect(TRACKING_STATUS_EVENTS.length).toBeGreaterThan(0);
  });

  it('subscribes to no name that is not a declared domain event', () => {
    // Catches the typo'd `eventBus.subscribe('RiderAssignd', …)` that would otherwise never fire
    // and never fail: the in-process bus has no registry to reject an unknown name against.
    expect(subscribed.filter((name) => !declared.includes(name))).toEqual([]);
  });

  it('leaves no declared event unsubscribed, apart from the outbox-delivered one', () => {
    expect(declared.filter((name) => !subscribed.includes(name))).toEqual(OUTBOX_DELIVERED);
  });

  it('routes every outbox-delivered event through the relay dispatch table', () => {
    const container = readFileSync(join(SRC_ROOT, 'container', 'index.ts'), 'utf8');
    const table = container.match(/new OutboxDispatcher\(\{([\s\S]*?)\}\)/);
    expect(table).not.toBeNull();

    const routed = [...(table as RegExpMatchArray)[1].matchAll(/^\s*(\w+)\s*:/gm)].map((m) => m[1]);

    expect(routed.sort()).toEqual([...OUTBOX_DELIVERED].sort());
  });
});
