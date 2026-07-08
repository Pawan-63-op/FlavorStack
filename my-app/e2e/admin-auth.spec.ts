import { test, expect } from "@playwright/test";
import { login } from "./fixtures/seed";
import { flushRateLimits } from "./fixtures/seed";


test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await flushRateLimits();
});

test.describe("admin auth gate @smoke @regression", () => {
  test("guarded redirect: /admin while logged out → /login?from=", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?from=%2Fadmin/);
  });

  test("authenticated user can reach the admin dashboard", async ({ page }) => {
    await login(page);
    await page.goto("/admin");

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText("Admin Dashboard")).toBeVisible();
  });
});
