import { test, expect, type Page } from "@playwright/test";
import {
  login,
  hasCookie,
  expectOnLogin,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "./fixtures/seed";
import { flushRateLimits } from "./fixtures/seed";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await flushRateLimits();
});

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

test.describe("auth lifecycle @smoke @regression", () => {
  test("login sets the session and lands on a protected route", async ({ page }) => {
    await login(page);

    await expect(page).not.toHaveURL(/\/login/);
    expect(await hasCookie(page, ACCESS_TOKEN_COOKIE)).toBe(true);
    expect(await hasCookie(page, REFRESH_TOKEN_COOKIE)).toBe(true);
  });

  test("reload persists the session via /users/me", async ({ page }) => {
    await login(page);
    const landed = page.url();

    await page.reload();

    await expect(page).not.toHaveURL(/\/login/);
    expect(page.url()).toBe(landed);
    expect(await hasCookie(page, ACCESS_TOKEN_COOKIE)).toBe(true);
  });

  test("refresh recovery: session survives access-token expiry", async ({ page }) => {
    await login(page);

    await page.context().clearCookies({ name: ACCESS_TOKEN_COOKIE });
    expect(await hasCookie(page, ACCESS_TOKEN_COOKIE)).toBe(false);
    expect(await hasCookie(page, REFRESH_TOKEN_COOKIE)).toBe(true);

    const refreshCalls = await countRefreshCalls(page, async () => {
      await page.reload();
      await page.waitForLoadState("networkidle");
    });

    // The user-visible contract: the session recovers, silently, via the refresh path.
    await expect(page).not.toHaveURL(/\/login/);
    expect(await hasCookie(page, ACCESS_TOKEN_COOKIE)).toBe(true);

    // At least one refresh proves recovery went through /auth/refresh rather than some
    // other path. We deliberately do NOT assert exactly one.
    //
    // Single-flight state (`refreshPromise` in lib/api/client/withRefresh.ts) is per-document
    // JS state, and a reload spans two document lifetimes: the outgoing document's in-flight
    // fetches can 401 and refresh before teardown, then the fresh document initialises a new
    // module instance and refreshes again for its own bootstrap. Whether the outgoing document
    // gets that far is a race, so the total is legitimately 1 or 2 — asserting `toBe(1)` made
    // this test flaky rather than strict.
    //
    // The strict single-flight property — N concurrent 401s collapse into exactly one refresh —
    // is deterministic *within* a document and is unit-tested there:
    // lib/api/client/withRefresh.test.ts, "collapses N concurrent 401s into exactly one refresh call".
    expect(refreshCalls).toBeGreaterThanOrEqual(1);
    expect(refreshCalls).toBeLessThanOrEqual(2);
  });

  test("guarded redirect: protected route while logged out → /login?from=", async ({ page }) => {
    await page.goto("/profile");

    await expect(page).toHaveURL(/\/login\?from=%2Fprofile/);
  });

  test("logout clears cookies and returns to login", async ({ page }) => {
    await login(page);

    await page.locator("header").locator("button:has(svg.lucide-user)").first().click();
    await page.getByRole("menuitem", { name: "Logout" }).click();

    await expectOnLogin(page);
    expect(await hasCookie(page, ACCESS_TOKEN_COOKIE)).toBe(false);
    expect(await hasCookie(page, REFRESH_TOKEN_COOKIE)).toBe(false);
  });
});
