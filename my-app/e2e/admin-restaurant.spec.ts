import { test, expect } from "@playwright/test";
import { login } from "./fixtures/seed";
import { flushRateLimits } from "./fixtures/seed";


test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await flushRateLimits();
});

test.describe("owner restaurant management @regression", () => {
  test("create, add category, publish, and set visibility public", async ({ page }) => {
    await login(page);
    await page.goto("/admin");
    await page.getByRole("tab", { name: "Restaurants" }).click();

    const restaurantName = `E2E Diner ${Date.now()}`;

    await page.getByRole("button", { name: "Add Restaurant" }).click();
    await page.getByLabel("Name *").fill(restaurantName);
    await page.getByLabel(/North Indian/i).check();
    await page.getByLabel("Street *").fill("12 MG Road");
    await page.getByLabel("City *").fill("Pune");
    await page.getByLabel("State *").fill("Maharashtra");
    await page.getByLabel("PIN code *").fill("411001");
    await page.getByLabel("Latitude *").fill("18.52");
    await page.getByLabel("Longitude *").fill("73.85");
    await page.getByLabel("Phone *").fill("+15551239999");
    await page.getByRole("button", { name: "Create Restaurant" }).click();

    const card = page.locator('[data-testid^="restaurant-card-"]').filter({ hasText: restaurantName });
    await expect(page.getByRole("heading", { name: restaurantName })).toBeVisible();
    await expect(card.getByText("DRAFT")).toBeVisible();
    await expect(card.getByText("Add an active category to publish")).toBeVisible();

    await page.getByRole("button", { name: `Expand ${restaurantName}` }).click();
    await page.getByPlaceholder("New category label").fill("Starters");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("Starters")).toBeVisible();

    await expect(card.getByRole("button", { name: "Publish" })).toBeEnabled();
    await card.getByRole("button", { name: "Publish" }).click();
    await expect(card.getByText("ACTIVE")).toBeVisible();

    await card.getByLabel(`Visibility for ${restaurantName}`).click();
    await page.getByRole("option", { name: "PUBLIC", exact: true }).click();
    await expect(card.getByLabel(`Visibility for ${restaurantName}`)).toContainText("PUBLIC");
  });
});
