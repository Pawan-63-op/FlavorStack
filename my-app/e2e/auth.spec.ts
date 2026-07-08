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

    await expect(page).not.toHaveURL(/\/login/);
    expect(refreshCalls).toBe(1);
    expect(await hasCookie(page, ACCESS_TOKEN_COOKIE)).toBe(true);
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
