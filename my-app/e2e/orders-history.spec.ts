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
    await expect(page.getByText("Order placed")).toBeVisible();
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
