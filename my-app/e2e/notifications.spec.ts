import { test, expect, type Page } from "@playwright/test";
import { login } from "./fixtures/seed";
import { seedServiceableRestaurant, placeOrder, SEED_LAT, SEED_LNG } from "./fixtures/seed";
import { flushRateLimits } from "./fixtures/seed";


const NOTIFICATIONS_ON =
  process.env.NEXT_PUBLIC_FEATURE_NOTIFICATIONS === "true" ||
  process.env.NEXT_PUBLIC_FEATURE_NOTIFICATIONS === "1";

/** Poll the unread-count API (shares the page's cookies) until it satisfies `predicate`. */
async function pollUnreadCount(page: Page, predicate: (count: number) => boolean): Promise<number> {
  let last = -1;
  await expect
    .poll(
      async () => {
        const res = await page.request.get("/api/v1/me/notifications/unread-count");
        if (!res.ok()) return false;
        last = ((await res.json()) as { count: number }).count;
        return predicate(last);
      },
      { timeout: 30_000, intervals: [500, 1000, 2000] },
    )
    .toBe(true);
  return last;
}

test.describe("notifications center (Phase 8, Batch 8.2) @regression", () => {
  test.beforeEach(async () => {
    await flushRateLimits();
  });

  test("flag OFF: header has no notification bell (regression-safe)", async ({ page }) => {
    test.skip(NOTIFICATIONS_ON, "flag is on — see the notifications-center test below");
    test.setTimeout(60_000);

    await login(page);
    await expect(page.getByRole("button", { name: "Notifications" })).toHaveCount(0);
  });

  test("flag ON: bell badge reflects unread, dropdown lists + marks read, View all paginates", async ({
    page,
    context,
    request,
  }) => {
    test.skip(!NOTIFICATIONS_ON, "requires NEXT_PUBLIC_FEATURE_NOTIFICATIONS=true npm run test:e2e");
    test.setTimeout(180_000);

    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: SEED_LAT, longitude: SEED_LNG });

    const restaurant = await seedServiceableRestaurant(request);
    await login(page);
    await placeOrder(page, restaurant.id);

    await pollUnreadCount(page, (c) => c >= 1);

    await page.goto("/");
    const bell = page.getByRole("button", { name: "Notifications" });
    await expect(bell).toBeVisible({ timeout: 15_000 });
    await expect(bell).toContainText(/\d/);

    await bell.click();
    await expect(page.getByText("Order confirmed").first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole("link", { name: "View all" }).click();
    await page.waitForURL(/\/notifications/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();

    const deepLink = page.locator('a[href^="/order-processing?fulfillmentId="]').first();
    await expect(deepLink).toBeVisible({ timeout: 15_000 });

    const [readRequest] = await Promise.all([
      page.waitForRequest(
        (req) => /\/me\/notifications\/.+\/read$/.test(req.url()) && req.method() === "PATCH",
        { timeout: 15_000 },
      ),
      deepLink.click(),
    ]);
    expect(readRequest.method()).toBe("PATCH");
  });

  test("flag ON: toggling a preference persists across reload (Batch 8.3)", async ({ page }) => {
    test.skip(!NOTIFICATIONS_ON, "requires NEXT_PUBLIC_FEATURE_NOTIFICATIONS=true npm run test:e2e");
    test.setTimeout(120_000);

    await login(page);

    await page.goto("/profile/preferences");
    await expect(page.getByRole("heading", { name: "Notification preferences" })).toBeVisible({
      timeout: 15_000,
    });

    const promotionsEmail = page.getByRole("switch", { name: "Promotions email" });
    await expect(promotionsEmail).toBeVisible();
    const before = await promotionsEmail.getAttribute("aria-checked");
    await promotionsEmail.click();
    const after = await promotionsEmail.getAttribute("aria-checked");
    expect(after).not.toBe(before);

    const [putResponse] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes("/me/notification-preferences") &&
          res.request().method() === "PUT",
        { timeout: 15_000 },
      ),
      page.getByRole("button", { name: "Save changes" }).click(),
    ]);
    expect(putResponse.ok()).toBe(true);

    await page.reload();
    await expect(page.getByRole("switch", { name: "Promotions email" })).toHaveAttribute(
      "aria-checked",
      after as string,
      { timeout: 15_000 },
    );

    if (after === "true") {
      await page.getByRole("switch", { name: "Promotions email" }).click();
      await Promise.all([
        page.waitForResponse(
          (res) =>
            res.url().includes("/me/notification-preferences") &&
            res.request().method() === "PUT",
        ),
        page.getByRole("button", { name: "Save changes" }).click(),
      ]);
    }
  });
});
