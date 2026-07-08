import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test, expect, type Page } from "@playwright/test";
import { io } from "socket.io-client";
import {
  login,
  hasCookie,
  expectOnLogin,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  SEED_LAT,
  SEED_LNG,
} from "./fixtures/seed";

/**
 * Phase 12, Batch 12.3 — SAME-ORIGIN production smoke (`prod-smoke` project).
 *
 * Proves the whole reason the production topology is same-origin: server_2's
 * auth cookies are frozen at `sameSite:'lax'` + `secure`, so the only way they
 * work is to serve the FE and proxy `/api/v1` + Socket.IO under ONE HTTPS origin
 * via nginx (deploy/). This spec drives that deployed origin over HTTPS and
 * asserts, end-to-end through nginx:
 *
 *   1. login sets `access_token` + `refresh_token` as **Secure** cookies on the
 *      single origin (NODE_ENV=production → `secure:true`);
 *   2. a guarded read (`/users/me`) succeeds with those cookies;
 *   3. a forced 401 (access token dropped) recovers via **exactly one** refresh
 *      on the path-scoped `/api/v1/auth/refresh`;
 *   4. the `/tracking` Socket.IO namespace **connects through nginx** (the WS
 *      Upgrade is proxied, not just HTTP) — the batch's #1 risk;
 *   5. logout clears both cookies.
 *
 * Run against the prod compose (NOT the dev stack) — see deploy/README.md:
 *   E2E_PROD_SMOKE=1 E2E_BASE_URL=https://localhost \
 *   E2E_MONGO_CONTAINER=deploy-mongo-1 \
 *     npm run test:e2e -- --project=prod-smoke
 *
 * Self-seeding: there is no shared dev seeder here, so the spec registers a
 * fresh unique customer through nginx and flips `isEmailVerified` directly in
 * the prod stack's Mongo (`docker exec`), the same out-of-band mechanism the
 * dev fixtures use. Override the container name with `E2E_MONGO_CONTAINER`
 * (default `deploy-mongo-1` — the `deploy/` compose project's mongo container).
 */

const exec = promisify(execFile);

const MONGO_CONTAINER = process.env.E2E_MONGO_CONTAINER ?? "deploy-mongo-1";
const MONGO_DB = process.env.E2E_MONGO_DB ?? "flavorstack";
const ORIGIN = process.env.E2E_BASE_URL ?? "https://localhost";

/** Flip a freshly-registered customer to verified in the prod Mongo. */
async function markVerified(email: string): Promise<void> {
  const script = `db.users.updateOne({ email: "${email}" }, { $set: { isEmailVerified: true } }).matchedCount`;
  await exec("docker", [
    "exec",
    MONGO_CONTAINER,
    "mongosh",
    MONGO_DB,
    "--quiet",
    "--eval",
    script,
  ]);
}

/** Count POST /api/v1/auth/refresh calls the page makes while `fn` runs. */
async function countRefreshCalls(page: Page, fn: () => Promise<void>): Promise<number> {
  let count = 0;
  const onRequest = (req: { url: () => string; method: () => string }) => {
    if (req.method() === "POST" && req.url().includes("/api/v1/auth/refresh")) {
      count += 1;
    }
  };
  page.on("request", onRequest);
  try {
    await fn();
  } finally {
    page.off("request", onRequest);
  }
  return count;
}

test.describe("same-origin prod cookie/refresh/WS @smoke", () => {
  test("lax cookies, refresh rotation and the /tracking socket work through nginx", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);

    const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const user = {
      email: `e2e.prodsmoke.${unique}@flavorstack.local`,
      password: "Test@1234",
    };
    const register = await request.post("/api/v1/auth/register", {
      data: {
        role: "CUSTOMER",
        customer: {
          name: "Prod Smoke Customer",
          email: user.email,
          phone: `+91${unique.slice(-9).padStart(9, "9")}3`,
          password: user.password,
          address: {
            street: "123 MG Road",
            city: "Bengaluru",
            state: "Karnataka",
            pinCode: "560001",
            lat: SEED_LAT,
            lng: SEED_LNG,
          },
        },
      },
    });
    expect(register.ok(), `register failed: ${register.status()}`).toBeTruthy();
    await markVerified(user.email);

    await login(page, user);
    await expect(page).not.toHaveURL(/\/login/);

    const cookies = await page.context().cookies();
    const access = cookies.find((c) => c.name === ACCESS_TOKEN_COOKIE);
    const refresh = cookies.find((c) => c.name === REFRESH_TOKEN_COOKIE);
    expect(access, "access_token cookie missing").toBeTruthy();
    expect(refresh, "refresh_token cookie missing").toBeTruthy();
    expect(access!.secure, "access_token must be Secure in prod").toBe(true);
    expect(refresh!.secure, "refresh_token must be Secure in prod").toBe(true);
    expect(refresh!.path).toBe("/api/v1/auth/refresh");

    const me = await page.request.get("/api/v1/users/me");
    expect(me.ok(), `/users/me failed: ${me.status()}`).toBeTruthy();

    await connectTrackingSocket(access!.value);

    await page.context().clearCookies({ name: ACCESS_TOKEN_COOKIE });
    expect(await hasCookie(page, ACCESS_TOKEN_COOKIE)).toBe(false);
    expect(await hasCookie(page, REFRESH_TOKEN_COOKIE)).toBe(true);

    const refreshCalls = await countRefreshCalls(page, async () => {
      await page.reload();
      await page.waitForLoadState("networkidle");
    });
    await expect(page).not.toHaveURL(/\/login/);
    expect(refreshCalls).toBe(1);
    expect(await hasCookie(page, ACCESS_TOKEN_COOKIE)).toBe(true);

    await page.locator("header").locator("button:has(svg.lucide-user)").first().click();
    await page.getByRole("menuitem", { name: "Logout" }).click();
    await expectOnLogin(page);
    expect(await hasCookie(page, ACCESS_TOKEN_COOKIE)).toBe(false);
    expect(await hasCookie(page, REFRESH_TOKEN_COOKIE)).toBe(false);
  });
});

/**
 * Connect a Socket.IO client to the `/tracking` namespace through nginx over
 * WSS and resolve once the handshake completes. Auth is by `auth.token` (the
 * JWT from the access cookie — socketAuth accepts handshake auth, Bearer, or the
 * cookie). `rejectUnauthorized:false` tolerates the local self-signed cert.
 */
async function connectTrackingSocket(accessToken: string): Promise<void> {
  const socket = io(`${ORIGIN}/tracking`, {
    transports: ["websocket"],
    auth: { token: accessToken },
    reconnection: false,
    forceNew: true,
    rejectUnauthorized: false,
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("/tracking socket did not connect through nginx in 15s")),
        15_000,
      );
      socket.on("connect", () => {
        clearTimeout(timer);
        resolve();
      });
      socket.on("connect_error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
    expect(socket.connected).toBe(true);
  } finally {
    socket.disconnect();
  }
}
