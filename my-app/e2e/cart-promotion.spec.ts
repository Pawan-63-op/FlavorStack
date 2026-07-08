import { test, expect } from "@playwright/test";
import { login, flushRateLimits } from "./fixtures/seed";
import { seedRestaurant } from "./fixtures/seed";


const PRICE = "₹299.99"; // 29999 INR minor units, qty 1
const SAVE10_DISCOUNT = "₹30.00"; // 10% of 29999, rounded to the nearest paisa

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

test.describe("cart promotions (Batch 5.3) @regression", () => {
  test.beforeEach(async () => {
    await flushRateLimits();
  });

  test("apply / remove / invalid-code / check-preview", async ({ page, request }) => {
    const restaurant = await seedRestaurant(request, { name: `Promo Diner ${Date.now()}` });

    await login(page);
    await clearServerCart(page);
    await addMargheritaToCart(page, restaurant.name);

    await page.goto("/cart");
    await expect(page.getByText(PRICE).first()).toBeVisible({ timeout: 15_000 });

    await test.step("apply a valid code persists the discount", async () => {
      await page.getByLabel("Promo code").fill("SAVE10");
      await page.getByRole("button", { name: "Apply" }).click();

      await expect(page.getByText("SAVE10", { exact: true })).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(`-${SAVE10_DISCOUNT}`)).toBeVisible();
    });

    await test.step("remove clears the applied promotion", async () => {
      await page.getByRole("button", { name: "Remove promotion" }).click();

      await expect(page.getByText("SAVE10", { exact: true })).toHaveCount(0, { timeout: 10_000 });
      await expect(page.getByLabel("Promo code")).toBeVisible();
    });

    await test.step("an unknown code surfaces an inline error and does not apply", async () => {
      await page.getByLabel("Promo code").fill("NOT-A-REAL-CODE");
      await page.getByRole("button", { name: "Apply" }).click();

      await expect(page.getByText(/promotion code not found/i)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("button", { name: "Remove promotion" })).toHaveCount(0);
    });

    await test.step("check previews the discount without persisting it", async () => {
      await page.getByLabel("Promo code").fill("SAVE10");
      await page.getByRole("button", { name: "Check", exact: true }).click();

      await expect(page.getByText(/this code saves/i)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("button", { name: "Remove promotion" })).toHaveCount(0);

      await page.reload();
      await expect(page.getByText(PRICE).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("button", { name: "Remove promotion" })).toHaveCount(0);
    });
  });
});
