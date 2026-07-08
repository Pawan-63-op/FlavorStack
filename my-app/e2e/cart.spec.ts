import { test, expect } from "@playwright/test";
import { login, flushRateLimits } from "./fixtures/seed";
import { seedRestaurant } from "./fixtures/seed";


const PRICE = "₹299.99"; // 29999 INR minor units, qty 1
const PRICE_X2 = "₹599.98"; // qty 2

/** Reset the logged-in customer's server cart so each run starts clean. */
async function clearServerCart(page: import("@playwright/test").Page): Promise<void> {
  await page.request.delete("/api/v1/cart");
}

async function addMargheritaToCart(
  page: import("@playwright/test").Page,
  restaurantName: string,
): Promise<void> {
  await page.goto("/restaurants");
  const card = page.getByText(restaurantName, { exact: false });
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();

  await expect(page.getByText("Margherita Pizza")).toBeVisible();
  await page.getByRole("button", { name: /Add to Cart/i }).first().click();
}

test.describe("server cart (Batch 5.2) @regression", () => {
  test.beforeEach(async () => {
    await flushRateLimits();
  });

  test("add → increment → decrement → remove reflect server state", async ({ page, request }) => {
    const restaurant = await seedRestaurant(request, { name: `Cart Diner ${Date.now()}` });

    await login(page);
    await clearServerCart(page);
    await addMargheritaToCart(page, restaurant.name);

    await page.goto("/cart");
    await expect(page.getByText("Margherita Pizza")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(PRICE).first()).toBeVisible();

    await page.getByRole("button", { name: "Increase quantity" }).click();
    await expect(page.getByText(PRICE_X2).first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Decrease quantity" }).click();
    await expect(page.getByText(PRICE_X2)).toHaveCount(0, { timeout: 10_000 });

    await page.getByRole("button", { name: "Remove item" }).click();
    await expect(page.getByText("Your cart is empty")).toBeVisible({ timeout: 10_000 });
  });

  test("clear cart empties the server cart", async ({ page, request }) => {
    const restaurant = await seedRestaurant(request, { name: `Clear Diner ${Date.now()}` });

    await login(page);
    await clearServerCart(page);
    await addMargheritaToCart(page, restaurant.name);

    await page.goto("/cart");
    await expect(page.getByText("Margherita Pizza")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Clear cart" }).click();
    await expect(page.getByText("Your cart is empty")).toBeVisible({ timeout: 10_000 });
  });
});
