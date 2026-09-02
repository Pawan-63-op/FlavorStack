import { test, expect } from "@playwright/test";
import { login, flushRateLimits } from "./fixtures/seed";
import { seedRestaurant } from "./fixtures/seed";
import { isEnabled } from "./fixtures/flags";

const NEARBY_ON = isEnabled("nearby");

const SEED_LAT = 12.9716;
const SEED_LNG = 77.5946;

test.describe("nearby (flag-gated) @regression", () => {
  test.beforeEach(async () => {
    await flushRateLimits();
  });

  test("flag OFF: no nearby UI on Home (regression-safe)", async ({ page }) => {
    test.skip(NEARBY_ON, "flag is on — see the positive-path test below");

    await login(page);
    await page.goto("/Home");

    await expect(page.getByRole("heading", { name: "Near You" })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /find restaurants near me/i }),
    ).toHaveCount(0);
  });

  test("flag ON: permission grant → nearby results", async ({ page, context, request }) => {
    test.skip(!NEARBY_ON, "set NEXT_PUBLIC_FEATURE_NEARBY=true to run this");

    const restaurant = await seedRestaurant(request, {
      name: `Nearby Diner ${Date.now()}`,
      cuisineTypes: ["ITALIAN"],
    });

    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: SEED_LAT, longitude: SEED_LNG });

    await login(page);
    await page.goto("/Home");

    await expect(page.getByRole("heading", { name: "Near You" })).toBeVisible();
    await page.getByRole("button", { name: /find restaurants near me/i }).click();

    await expect(page.getByText(restaurant.name)).toBeVisible({ timeout: 15_000 });
  });
});
