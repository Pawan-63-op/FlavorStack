import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

/**
 * Guard against a bug that shipped in five specs at once.
 *
 * Each had re-implemented feature-flag resolution as
 * `process.env.NEXT_PUBLIC_FEATURE_X === "true" || === "1"`, which reads an **unset** var as
 * OFF. The app reads unset as `DEFAULT_FLAGS[flag]`, and `notifications`, `tracking`, `nearby`
 * and `reviews` all default **ON**. So every one of those specs ran its `flag OFF` variant
 * against an app where the feature was enabled, then failed asserting a UI element was absent.
 *
 * Specs must resolve flags through `e2e/fixtures/flags.ts` (which re-exports the app's own
 * `isEnabled`) so there is exactly one source of truth.
 */
// Lives outside `e2e/` on purpose: Playwright's testDir matches `*.test.ts` too,
// so a vitest file in there is picked up as a spec and fails the E2E run on import.
const E2E_DIR = join(__dirname, "..", "..", "e2e");

describe("e2e flag resolution", () => {
  const specs = readdirSync(E2E_DIR).filter((f) => f.endsWith(".spec.ts"));

  it("finds the spec files (guards against an empty sweep)", () => {
    expect(specs.length).toBeGreaterThan(5);
  });

  it("no spec re-implements NEXT_PUBLIC_FEATURE_* resolution by hand", () => {
    const offenders = specs.filter((f) =>
      /process\.env\.NEXT_PUBLIC_FEATURE_/.test(readFileSync(join(E2E_DIR, f), "utf8")),
    );

    expect(offenders).toEqual([]);
  });
});
