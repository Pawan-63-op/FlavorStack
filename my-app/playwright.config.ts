import { defineConfig, devices } from "@playwright/test";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "e2e/.env") });
// Also load the file the Next.js dev server itself reads. When a dev server is already
// running (`reuseExistingServer`, i.e. `make dev-up`), the `webServer.env` block below is
// never applied to it — so without this the test process and the app under test disagree
// about which feature flags are on. dotenv does not overwrite already-set vars, so
// e2e/.env keeps precedence.
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const PROXY_TARGET = process.env.API_PROXY_TARGET ?? "http://localhost:3000";
const PORT = new URL(BASE_URL).port || "3100";

const IS_PROD_SMOKE =
  !!process.env.E2E_PROD_SMOKE || (process.env.E2E_BASE_URL?.startsWith("https://") ?? false);
const PROD_SMOKE_BASE_URL = process.env.E2E_BASE_URL ?? "https://localhost";
const PROD_SMOKE_SPEC = /cross-origin\.smoke\.spec\.ts$/;

/** Forward every `NEXT_PUBLIC_FEATURE_*` this process has, and only those. */
function flagEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] =>
        entry[0].startsWith("NEXT_PUBLIC_FEATURE_") && entry[1] !== undefined,
    ),
  );
}


export default defineConfig({
  testDir: "./e2e",
  globalSetup: IS_PROD_SMOKE ? undefined : "./e2e/fixtures/seed.ts",
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: PROD_SMOKE_SPEC,
    },
    ...(IS_PROD_SMOKE
      ? [
          {
            name: "prod-smoke",
            testMatch: PROD_SMOKE_SPEC,
            use: {
              ...devices["Desktop Chrome"],
              baseURL: PROD_SMOKE_BASE_URL,
              ignoreHTTPSErrors: true,
            },
          },
        ]
      : []),
  ],
  webServer: IS_PROD_SMOKE
    ? undefined
    : {
        command: `npm run dev -- --port ${PORT}`,
        url: BASE_URL,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
        env: {
          PORT,
          API_PROXY_TARGET: PROXY_TARGET,
          NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1",
          NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL ?? PROXY_TARGET,
          // Feature flags are forwarded ONLY when actually set. A `?? "false"` default here
          // is not neutral: `lib/config/featureFlags.ts` defaults several flags (nearby,
          // reviews, tracking, notifications) to **true**, so an explicit "false" overrode
          // the app's own default while `e2e/fixtures/flags.ts` — which reads the same
          // `isEnabled()` from this process, where the var is unset — still resolved ON.
          // The `flag ON` specs then ran against an app with the feature OFF and failed
          // asserting UI that was correctly absent. Omitting the key lets the dev server
          // inherit `.env.local`/`process.env` and otherwise fall back to the app default,
          // which is exactly what the specs assume.
          ...flagEnv(),
        },
      },
});
