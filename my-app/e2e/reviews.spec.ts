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
import { isEnabled } from "./fixtures/flags";


const REVIEWS_ON = isEnabled("reviews");

function orderRequestIdFromUrl(url: string): string {
  const id = new URL(url).searchParams.get("orderRequestId");
  if (!id) throw new Error(`no orderRequestId in ${url}`);
  return id;
}

test.describe("reviews submission (Phase 9, Batch 9.2) @regression", () => {
  test.beforeEach(async () => {
    await flushRateLimits();
  });

  test("flag OFF: the feedback page shows no review form (regression-safe)", async ({
    page,
    context,
    request,
  }) => {
    test.skip(REVIEWS_ON, "flag is on — see the gating test below");
    test.setTimeout(120_000);

    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: SEED_LAT, longitude: SEED_LNG });

    const restaurant = await seedServiceableRestaurant(request);
    await login(page);
    await placeOrder(page, restaurant.id);
    const orderRequestId = orderRequestIdFromUrl(page.url());

    await page.goto(`/feedback/${encodeURIComponent(orderRequestId)}`);
    await expect(page.getByText("Reviews are unavailable")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Submit review" })).toHaveCount(0);
  });

  test("flag ON: a non-delivered order is gated client- and server-side", async ({
    page,
    context,
    request,
  }) => {
    test.skip(!REVIEWS_ON, "requires NEXT_PUBLIC_FEATURE_REVIEWS=true npm run test:e2e");
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

    await page.goto(`/feedback/${encodeURIComponent(orderRequestId)}`);
    await expect(page.getByText("Reviews open after delivery")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Submit review" })).toHaveCount(0);

    const res = await page.request.post(`/api/v1/restaurants/${restaurant.id}/reviews`, {
      data: { fulfillmentId, restaurantRating: 5, deliveryRating: 4, comment: "Great" },
    });
    expect(res.status()).toBe(422);
    const body = (await res.json()) as { error?: { code?: string; message?: string } };
    expect(body.error?.code).toBe("VALIDATION_ERROR");
    expect(body.error?.message).toBe("review_not_eligible");
  });
});
