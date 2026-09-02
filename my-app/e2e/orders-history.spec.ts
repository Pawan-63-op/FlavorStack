import { test, expect } from "@playwright/test";
import { login } from "./fixtures/seed";
import { seedServiceableRestaurant, placeOrder, SEED_LAT, SEED_LNG } from "./fixtures/seed";
import { flushRateLimits } from "./fixtures/seed";


test.describe("order history (Phase 7, Batch 7.2) @regression", () => {
  test.beforeEach(async () => {
    await flushRateLimits();
  });

  test("placed orders render in /orders from live server data, newest first", async ({
    page,
    context,
    request,
  }) => {
    test.setTimeout(180_000);

    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: SEED_LAT, longitude: SEED_LNG });

    const restaurantA = await seedServiceableRestaurant(request);
    const restaurantB = await seedServiceableRestaurant(request);
    await login(page);

    await placeOrder(page, restaurantA.id);
    await placeOrder(page, restaurantB.id);

    await page.goto("/orders");

    await expect(page.getByText(restaurantB.name, { exact: false })).toBeVisible({
      timeout: 15_000,
    });
    // Assert the SETTLED status, not the transient one.
    //
    // "Order placed" is the pre-fulfillment `REQUESTED` badge, shown only while the order has no
    // `lastKnownStatus` — i.e. before it appears in server-truth `GET /me/orders`, which is
    // seeded from the fulfillment. Since Phase 7 the fulfillment is created asynchronously by the
    // outbox relay, so that badge is a window roughly one poll interval wide and racing it made
    // this assertion flaky. "Order received" (`CREATED`) is the state the order settles into, and
    // status only moves forward, so this is stable — Playwright just retries until the relay lands.
    await expect(page.getByText("Order received").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /Track Order/i }).first()).toBeVisible();

    await page.getByRole("button", { name: /Details/i }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Margherita Pizza", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: /Track Order/i }).first().click();
    await page.waitForURL(/\/order-processing\?orderRequestId=/, { timeout: 15_000 });

    await page.goto("/orders");
    await page.getByRole("tab", { name: "Order History" }).click();
    await expect(page.getByText(restaurantA.name, { exact: false })).toBeVisible({
      timeout: 15_000,
    });
  });
});
