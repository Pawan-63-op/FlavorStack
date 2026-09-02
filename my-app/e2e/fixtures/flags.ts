/**
 * Feature-flag resolution for E2E specs.
 *
 * Specs MUST NOT re-implement this as `process.env.X === "true"`. That treats an unset var
 * as OFF, whereas the app treats it as `DEFAULT_FLAGS[flag]` — and several flags default
 * **ON**. A spec that guesses wrong runs its `flag OFF` variant against an app where the
 * feature is enabled, and fails asserting a UI element is absent when it is rightly present.
 *
 * Delegating to the app's own `isEnabled` keeps exactly one source of truth: change a default
 * in `lib/config/featureFlags.ts` and the specs follow automatically.
 *
 * This works because `playwright.config.ts` loads the same `.env.local` the dev server reads,
 * so `process.env` here matches the env the app was built with.
 */
export { isEnabled, type FeatureFlag } from "../../lib/config/featureFlags";
