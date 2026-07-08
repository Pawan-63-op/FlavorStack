import { test, expect } from "@playwright/test";
import { login } from "./fixtures/seed";
import {
  seedServiceableRestaurant,
  placeOrder,
  findFulfillmentForOrder,
  SEED_LAT,
  SEED_LNG,
} from "./fixtures/seed";
import { flushRateLimits } from "./fixtures/seed";


const TRACKING_ON =
  process.env.NEXT_PUBLIC_FEATURE_TRACKING === "true" ||
  process.env.NEXT_PUBLIC_FEATURE_TRACKING === "1";

function orderRequestIdFromUrl(url: string): string {
  const id = new URL(url).searchParams.get("orderRequestId");
  if (!id) throw new Error(`no orderRequestId in ${url}`);
  return id;
}

test.describe("order tracking (Phase 7, Batch 7.3) @regression", () => {
  test.beforeEach(async () => {
    await flushRateLimits();
  });

  test("flag OFF: order-processing keeps the static confirmation (regression-safe)", async ({
    page,
    context,
    request,
  }) => {
    test.skip(TRACKING_ON, "flag is on — see the positive-path test below");
    test.setTimeout(120_000);

    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: SEED_LAT, longitude: SEED_LNG });

    const restaurant = await seedServiceableRestaurant(request);
    await login(page);
    await placeOrder(page, restaurant.id);

    await expect(
      page.getByRole("heading", { name: "Order Placed Successfully!" }),
    ).toBeVisible();
    await expect(page.getByText("Order Tracking")).toHaveCount(0);
  });

  test("flag ON: a known fulfillmentId renders live tracking on /order-processing", async ({
    page,
    context,
    request,
  }) => {
    test.skip(!TRACKING_ON, "requires NEXT_PUBLIC_FEATURE_TRACKING=true npm run test:e2e");
    test.setTimeout(180_000);

    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: SEED_LAT, longitude: SEED_LNG });

    const restaurant = await seedServiceableRestaurant(request);
    await login(page);
    await placeOrder(page, restaurant.id);

    const orderRequestId = orderRequestIdFromUrl(page.url());
    const fulfillmentId = await findFulfillmentForOrder(
      request,
      restaurant.id,
      restaurant.ownerAccessToken,
      orderRequestId,
    );

    await page.evaluate(
      ({ orderRequestId, fulfillmentId }) => {
        const raw = window.localStorage.getItem("tracked-orders");
        const orders: { orderRequestId: string; fulfillmentId?: string }[] = raw
          ? JSON.parse(raw)
          : [];
        const next = orders.map((o) =>
          o.orderRequestId === orderRequestId ? { ...o, fulfillmentId } : o,
        );
        window.localStorage.setItem("tracked-orders", JSON.stringify(next));
      },
      { orderRequestId, fulfillmentId },
    );

    await page.goto(`/order-processing?orderRequestId=${encodeURIComponent(orderRequestId)}`);

    await expect(page.getByText("Order Tracking")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Order received").first()).toBeVisible();
    await expect(page.getByText("Status Timeline")).toBeVisible();
  });
});
