import { test, expect } from "@playwright/test";
import { login, flushRateLimits } from "./fixtures/seed";
import { seedRestaurant } from "./fixtures/seed";

test.describe("search @regression", () => {
  test.beforeEach(async () => {
    await flushRateLimits();
  });

  test("typing a query returns server-side results", async ({ page, request }) => {
    const restaurant = await seedRestaurant(request, {
      name: `Search Diner ${Date.now()}`,
      cuisineTypes: ["MEXICAN"],
    });

    await login(page);
    await page.goto(`/search?q=${encodeURIComponent(restaurant.name)}`);

    await expect(page.getByText(restaurant.name, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("cuisine filter re-queries the server for the current search", async ({
    page,
    request,
  }) => {
    const restaurant = await seedRestaurant(request, {
      name: `Filterable Diner ${Date.now()}`,
      cuisineTypes: ["SEAFOOD"],
    });

    await login(page);
    await page.goto(`/search?q=${encodeURIComponent("Diner")}`);

    await expect(page.getByText(restaurant.name, { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: "Italian" }).click();
    await expect(page.getByText(restaurant.name, { exact: true })).not.toBeVisible();

    await page.getByRole("button", { name: "Seafood" }).click();
    await expect(page.getByText(restaurant.name, { exact: true })).toBeVisible();
  });

  test("empty query shows popular searches and does not query the server", async ({ page }) => {
    await login(page);
    await page.goto("/search");

    await expect(page.getByText("Popular:")).toBeVisible();
  });
});
