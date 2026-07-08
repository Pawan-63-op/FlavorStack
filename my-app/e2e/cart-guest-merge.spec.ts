import { test, expect, type APIRequestContext } from "@playwright/test";
import { login, flushRateLimits } from "./fixtures/seed";
import { seedRestaurant } from "./fixtures/seed";
import { TEST_USER } from "./fixtures/seed";


const STORAGE_KEY = "guest-cart-storage";

interface SeededItem {
  menuItemId: string;
  amount: number;
  currency: string;
}

/** Read the seeded restaurant's "Margherita Pizza" id + price from the menu. */
async function getMargherita(request: APIRequestContext, restaurantId: string): Promise<SeededItem> {
  const res = await request.get(`/api/v1/catalog/restaurants/${restaurantId}/menu`);
  const body = (await res.json()) as {
    categories: { items: { id: string; name: string; basePriceAmount: number; currency: string }[] }[];
  };
  const item = body.categories.flatMap((c) => c.items).find((i) => i.name === "Margherita Pizza");
  if (!item) throw new Error("seeded menu item not found");
  return { menuItemId: item.id, amount: item.basePriceAmount, currency: item.currency };
}

/** Empty the TEST_USER server cart up front so the merge lands in a clean cart. */
async function clearServerCart(request: APIRequestContext): Promise<void> {
  const loginRes = await request.post("/api/v1/auth/login", {
    data: { email: TEST_USER.email, password: TEST_USER.password },
  });
  const { accessToken } = (await loginRes.json()) as { accessToken: string };
  await request.delete("/api/v1/cart", { headers: { Authorization: `Bearer ${accessToken}` } });
}

test.describe("guest cart merge (Batch 5.4) @regression", () => {
  test.beforeEach(async () => {
    await flushRateLimits();
  });

  test("items staged logged-out merge into the server cart on login", async ({ page, request }) => {
    const restaurant = await seedRestaurant(request, { name: `Guest Diner ${Date.now()}` });
    const item = await getMargherita(request, restaurant.id);
    await clearServerCart(request);

    const envelope = JSON.stringify({
      state: {
        lines: [
          {
            restaurantId: restaurant.id,
            restaurantName: restaurant.name,
            menuItemId: item.menuItemId,
            quantity: 1,
            unitPrice: { amount: item.amount, currency: item.currency },
            name: "Margherita Pizza",
          },
        ],
      },
      version: 0,
    });
    await page.goto("/login");
    await page.evaluate(
      ([key, value]) => localStorage.setItem(key, value),
      [STORAGE_KEY, envelope] as const,
    );

    await login(page);

    await page.goto("/cart");
    await expect(page.getByText("Margherita Pizza")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("₹299.99").first()).toBeVisible();

    const remaining = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw).state.lines as unknown[]).length : 0;
    }, STORAGE_KEY);
    expect(remaining).toBe(0);
  });
});
