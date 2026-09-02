import { test, expect, type Page } from "@playwright/test";
import { login, flushRateLimits } from "./fixtures/seed";
import { seedServiceableRestaurant, SEED_LAT, SEED_LNG } from "./fixtures/seed";
// Use the shared, idempotent helper. This spec used to carry its own `saveLocalAddress` that
// added the address unconditionally, so a second run — or any other spec that had already added
// it — left duplicates and the closing strict-mode assertion failed.
import { ensureLocalAddress } from "./fixtures/checkout";


async function clearServerCart(page: Page): Promise<void> {
  await page.request.delete("/api/v1/cart");
}

async function addMargheritaToCart(page: Page, restaurantId: string): Promise<void> {
  await page.goto(`/restaurants/${restaurantId}`);
  await expect(page.getByText("Margherita Pizza")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /Add to Cart/i }).first().click();
}

test.describe("checkout (Phase 6) @smoke @regression", () => {
  test.beforeEach(async () => {
    await flushRateLimits();
  });

  test("preview pricing → place order → confirmation", async ({ page, context, request }) => {
    test.setTimeout(120_000);

    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: SEED_LAT, longitude: SEED_LNG });

    const restaurant = await seedServiceableRestaurant(request);
    await login(page);

    await clearServerCart(page);
    await addMargheritaToCart(page, restaurant.id);
    await ensureLocalAddress(page);

    await page.goto("/checkout");

    const placeOrder = page.getByRole("button", { name: /Place Order/i });
    await expect(placeOrder).toBeEnabled({ timeout: 20_000 });
    await expect(page.getByText("Total", { exact: true })).toBeVisible();

    await placeOrder.click();

    await page.waitForURL(/\/order-processing/, { timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: "Order Placed Successfully!" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("REQUESTED")).toBeVisible();
    await expect(page.getByText(restaurant.name, { exact: false })).toBeVisible();
    await expect(page.getByText(/₹\s?\d/).first()).toBeVisible();
  });
});
