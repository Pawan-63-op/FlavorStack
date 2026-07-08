import { test, expect } from "@playwright/test";
import { login } from "./fixtures/seed";
import { flushRateLimits } from "./fixtures/seed";


test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await flushRateLimits();
});

test.describe("owner menu management @regression", () => {
  test("create restaurant + category, then add, toggle, and delete a menu item", async ({ page }) => {
    await login(page);
    await page.goto("/admin");

    await page.getByRole("tab", { name: "Restaurants" }).click();
    const restaurantName = `E2E Menu Diner ${Date.now()}`;

    await page.getByRole("button", { name: "Add Restaurant" }).click();
    await page.getByLabel("Name *").fill(restaurantName);
    await page.getByLabel(/North Indian/i).check();
    await page.getByLabel("Street *").fill("12 MG Road");
    await page.getByLabel("City *").fill("Pune");
    await page.getByLabel("State *").fill("Maharashtra");
    await page.getByLabel("PIN code *").fill("411001");
    await page.getByLabel("Latitude *").fill("18.52");
    await page.getByLabel("Longitude *").fill("73.85");
    await page.getByLabel("Phone *").fill("+15551238888");
    await page.getByRole("button", { name: "Create Restaurant" }).click();

    await expect(page.getByRole("heading", { name: restaurantName })).toBeVisible();
    await page.getByRole("button", { name: `Expand ${restaurantName}` }).click();
    await page.getByPlaceholder("New category label").fill("Starters");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("Starters")).toBeVisible();

    await page.getByRole("tab", { name: "Menus" }).click();
    await page.getByLabel("Select restaurant").click();
    await page.getByRole("option", { name: restaurantName }).click();

    await page.getByRole("button", { name: "Add Menu Item" }).click();
    await page.getByLabel("Category").click();
    await page.getByRole("option", { name: /Starters/ }).click();
    await page.getByLabel("Name *").fill("Paneer Tikka");
    await page.getByLabel("Price *").fill("250");
    await page.getByRole("button", { name: "Add Item" }).click();

    const itemCard = page.locator('[data-testid^="menu-item-"]').filter({ hasText: "Paneer Tikka" });
    await expect(itemCard).toBeVisible();

    await itemCard.getByLabel("Toggle availability").click();
    await expect(itemCard.getByText("Unavailable")).toBeVisible();

    await itemCard.getByRole("button", { name: "Delete Paneer Tikka" }).click();
    await expect(itemCard).toHaveCount(0);
  });
});
