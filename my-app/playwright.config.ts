import { defineConfig, devices } from "@playwright/test";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "e2e/.env") });

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const PROXY_TARGET = process.env.API_PROXY_TARGET ?? "http://localhost:3000";
const PORT = new URL(BASE_URL).port || "3100";

const IS_PROD_SMOKE =
  !!process.env.E2E_PROD_SMOKE || (process.env.E2E_BASE_URL?.startsWith("https://") ?? false);
const PROD_SMOKE_BASE_URL = process.env.E2E_BASE_URL ?? "https://localhost";
const PROD_SMOKE_SPEC = /cross-origin\.smoke\.spec\.ts$/;


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
          NEXT_PUBLIC_FEATURE_NEARBY: process.env.NEXT_PUBLIC_FEATURE_NEARBY ?? "false",
          NEXT_PUBLIC_FEATURE_TRACKING: process.env.NEXT_PUBLIC_FEATURE_TRACKING ?? "false",
          NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL ?? PROXY_TARGET,
          NEXT_PUBLIC_FEATURE_NOTIFICATIONS: process.env.NEXT_PUBLIC_FEATURE_NOTIFICATIONS ?? "false",
          NEXT_PUBLIC_FEATURE_REVIEWS: process.env.NEXT_PUBLIC_FEATURE_REVIEWS ?? "false",
        },
      },
});
