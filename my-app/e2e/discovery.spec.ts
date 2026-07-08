import { test, expect } from "@playwright/test";
import { login, flushRateLimits } from "./fixtures/seed";
import { seedRestaurant } from "./fixtures/seed";

test.describe("restaurant discovery @regression", () => {
  test.beforeEach(async () => {
    await flushRateLimits();
  });

  test("list renders from server_2 → detail shows menu + rating", async ({ page, request }) => {
    const restaurant = await seedRestaurant(request, {
      name: `Discovery Diner ${Date.now()}`,
      cuisineTypes: ["ITALIAN"],
    });

    await login(page);
    await page.goto("/restaurants");

    const card = page.getByText(restaurant.name, { exact: false });
    await expect(card).toBeVisible({ timeout: 15_000 });

    await card.click();

    await expect(page).toHaveURL(/\/restaurants\//);
    await expect(page.getByRole("heading", { name: restaurant.name })).toBeVisible();
    await expect(page.getByText("Margherita Pizza")).toBeVisible();
    await expect(page.getByText("₹299.99")).toBeVisible();
    await expect(page.getByText(/0\.0 \(0 reviews\)/)).toBeVisible();
  });

  test("cuisine filter re-queries the server", async ({ page, request }) => {
    const restaurant = await seedRestaurant(request, {
      name: `Filter Diner ${Date.now()}`,
      cuisineTypes: ["SEAFOOD"],
    });

    await login(page);
    await page.goto("/restaurants");

    await expect(page.getByText(restaurant.name)).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Italian" }).click();
    await expect(page.getByText(restaurant.name)).not.toBeVisible();

    await page.getByRole("button", { name: "Seafood" }).click();
    await expect(page.getByText(restaurant.name)).toBeVisible();
  });
});
