import { type APIRequestContext, type APIResponse, type Page, expect } from "@playwright/test";

/** Bengaluru — the seeded restaurant + the delivery point used by checkout. */
export const SEED_LAT = 12.9716;
export const SEED_LNG = 77.5946;

export interface SeededServiceableRestaurant {
  id: string;
  name: string;
  slug: string;
  /** The seeded restaurant owner's bearer token — needed to drive the fulfillment queue (Batch 7.3). */
  ownerAccessToken: string;
}

/** Throw a descriptive error (not a cryptic `undefined`) on a non-OK response. */
async function expectOk(res: APIResponse, label: string): Promise<APIResponse> {
  if (!res.ok()) {
    throw new Error(`${label} failed: ${res.status()} ${await res.text().catch(() => "")}`);
  }
  return res;
}

/**
 * Log in, retrying on `429` (server_2 rate-limits login 5/15min per IP). The
 * sliding window frees a slot as old entries age out, so a bounded retry keeps
 * the seed robust when other runs/probes have recently consumed slots.
 */
async function loginWithRetry(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await request.post("/api/v1/auth/login", { data: { email, password } });
    if (res.status() !== 429) {
      await expectOk(res, "login");
      return ((await res.json()) as { accessToken: string }).accessToken;
    }
    const retryAfter = Number(res.headers()["retry-after"] ?? "15");
    await new Promise((r) => setTimeout(r, Math.min(retryAfter, 15) * 1000));
  }
  throw new Error("login still rate-limited after retries");
}

/**
 * Seeds a published (ACTIVE + PUBLIC) restaurant with one available menu item
 * AND a delivery zone covering {@link SEED_LAT}/{@link SEED_LNG}, so that
 * `POST /checkout/preview` + `POST /checkout` resolve as serviceable. Unlike the
 * discovery `seedRestaurant` fixture (which discards the owner token), this keeps
 * the owner session to add the zone via the owner-write API.
 *
 * Mirrors the fresh-user-per-run pattern — no cleanup; each call is unique. After
 * seeding it polls the public `/serviceability` query until the zone projection
 * is live, so the subsequent UI checkout never races the async projection.
 */
export async function seedServiceableRestaurant(
  request: APIRequestContext,
): Promise<SeededServiceableRestaurant> {
  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `e2e.checkout.${unique}@flavorstack.local`;
  const name = `Checkout Diner ${unique}`;
  const phone = `+91${unique.slice(-9).padStart(9, "9")}0`;

  await request.post("/api/v1/auth/register", {
    data: {
      role: "CUSTOMER",
      customer: {
        name: "Checkout Owner",
        email,
        phone,
        password: "Test@1234",
        address: {
          street: "123 MG Road",
          city: "Bengaluru",
          state: "Karnataka",
          pinCode: "560001",
          lat: SEED_LAT,
          lng: SEED_LNG,
        },
      },
    },
  });

  const accessToken = await loginWithRetry(request, email, "Test@1234");
  const headers = { Authorization: `Bearer ${accessToken}` };

  const restaurantRes = await expectOk(
    await request.post("/api/v1/catalog/restaurants", {
      headers,
      data: {
        name,
        cuisineTypes: ["ITALIAN"],
        phone,
        address: {
          street: "123 MG Road",
          city: "Bengaluru",
          state: "Karnataka",
          pinCode: "560001",
          coordinates: { lat: SEED_LAT, lng: SEED_LNG },
        },
        location: { lat: SEED_LAT, lng: SEED_LNG },
      },
    }),
    "create restaurant",
  );
  const restaurant = (await restaurantRes.json()) as { id: string; slug: string };

  const categoryRes = await expectOk(
    await request.post(`/api/v1/catalog/restaurants/${restaurant.id}/categories`, {
      headers,
      data: { label: "Mains", sortOrder: 0 },
    }),
    "add category",
  );
  const categoryBody = (await categoryRes.json()) as { categories: { id: string }[] };
  const categoryId = categoryBody.categories[categoryBody.categories.length - 1].id;

  await request.post(`/api/v1/catalog/restaurants/${restaurant.id}/items`, {
    headers,
    data: {
      categoryId,
      name: "Margherita Pizza",
      description: "Classic",
      basePrice: { amount: 29999, currency: "INR" },
      dietary: ["VEG"],
    },
  });

  const half = 0.05;
  await request.post(`/api/v1/catalog/restaurants/${restaurant.id}/zones`, {
    headers,
    data: {
      action: "ADD",
      polygon: [
        { lat: SEED_LAT - half, lng: SEED_LNG - half },
        { lat: SEED_LAT - half, lng: SEED_LNG + half },
        { lat: SEED_LAT + half, lng: SEED_LNG + half },
        { lat: SEED_LAT + half, lng: SEED_LNG - half },
      ],
      feeMatrix: {
        tiers: [{ maxDistanceMeters: 50000, fee: { amount: 4000, currency: "INR" } }],
      },
      minOrder: { amount: 10000, currency: "INR" },
    },
  });

  await request.post(`/api/v1/catalog/restaurants/${restaurant.id}/publish`, { headers });
  await request.patch(`/api/v1/catalog/restaurants/${restaurant.id}/visibility`, {
    headers,
    data: { visibility: "PUBLIC" },
  });

  await waitUntilMenuReady(request, restaurant.id);
  await waitUntilServiceable(request, restaurant.id);

  return { id: restaurant.id, name, slug: restaurant.slug, ownerAccessToken: accessToken };
}

/**
 * Poll the public menu read model until the seeded item is queryable — the
 * restaurant detail page renders from this same endpoint, so without it the UI
 * can load the page before the menu projection has caught up.
 */
async function waitUntilMenuReady(
  request: APIRequestContext,
  restaurantId: string,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const res = await request.get(`/api/v1/catalog/restaurants/${restaurantId}/menu`);
        if (!res.ok()) return 0;
        const body = (await res.json()) as
          | { categories?: { items?: unknown[] }[]; items?: unknown[] }
          | unknown;
        const b = body as { categories?: { items?: unknown[] }[]; items?: unknown[] };
        const count =
          (b.items?.length ?? 0) +
          (b.categories ?? []).reduce((n, c) => n + (c.items?.length ?? 0), 0);
        return count;
      },
      { timeout: 30_000, intervals: [500, 1000, 2000] },
    )
    .toBeGreaterThan(0);
}

/**
 * Poll the public serviceability query until the seeded restaurant is delivered
 * to {@link SEED_LAT}/{@link SEED_LNG} — i.e. both the zone geo-projection and the
 * PUBLIC/ACTIVE restaurant_summary projection have caught up. Without this the UI
 * checkout can race the async projection and see a transient "not serviceable".
 */
async function waitUntilServiceable(
  request: APIRequestContext,
  restaurantId: string,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const res = await request.get(
          `/api/v1/catalog/serviceability?lat=${SEED_LAT}&lng=${SEED_LNG}&subtotalAmount=29999&currency=INR`,
        );
        if (!res.ok()) return false;
        const body = (await res.json()) as
          | { items?: { restaurantId: string }[] }
          | { restaurantId: string }[];
        const items = Array.isArray(body) ? body : (body.items ?? []);
        return items.some((r) => r.restaurantId === restaurantId);
      },
      { timeout: 30_000, intervals: [500, 1000, 2000] },
    )
    .toBe(true);
}

interface RestaurantFulfillmentSummary {
  fulfillmentId: string;
  orderRequestId: string;
  status: string;
}

/**
 * Polls the restaurant owner's fulfillment queue (`GET
 * /restaurants/:id/fulfillments?status=CREATED`) until the fulfillment
 * auto-created for {@link orderRequestId} appears — `OnOrderRequested` runs
 * asynchronously off the checkout outbox, so this can lag the UI redirect to
 * `/order-processing` by a beat.
 */
export async function findFulfillmentForOrder(
  request: APIRequestContext,
  restaurantId: string,
  ownerAccessToken: string,
  orderRequestId: string,
): Promise<string> {
  const headers = { Authorization: `Bearer ${ownerAccessToken}` };
  let fulfillmentId: string | undefined;

  await expect
    .poll(
      async () => {
        const res = await request.get(
          `/api/v1/restaurants/${restaurantId}/fulfillments?status=CREATED`,
          { headers },
        );
        if (!res.ok()) return false;
        const fulfillments = (await res.json()) as RestaurantFulfillmentSummary[];
        const match = fulfillments.find((f) => f.orderRequestId === orderRequestId);
        fulfillmentId = match?.fulfillmentId;
        return Boolean(fulfillmentId);
      },
      { timeout: 30_000, intervals: [500, 1000, 2000] },
    )
    .toBe(true);

  return fulfillmentId as string;
}

/** Browser-driven checkout flow shared by the order-history (7.2) and order-tracking (7.3) specs. */
export async function clearServerCart(request: APIRequestContext): Promise<void> {
  await request.delete("/api/v1/cart");
}

export async function addMargheritaToCart(page: Page, restaurantId: string): Promise<void> {
  await page.goto(`/restaurants/${restaurantId}`);
  await expect(page.getByText("Margherita Pizza")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /Add to Cart/i }).first().click();
}

export async function ensureLocalAddress(page: Page): Promise<void> {
  await page.goto("/profile/addresses");
  if (
    await page
      .getByText("123 MG Road, Bengaluru, Karnataka 560001")
      .isVisible()
      .catch(() => false)
  ) {
    return;
  }
  await page.getByRole("button", { name: "Add Address" }).click();
  await page.getByPlaceholder("John Doe").fill("E2E Customer");
  await page.getByPlaceholder("+1 (555) 123-4567").fill("+919876543210");
  await page.getByPlaceholder("123 Main Street, Apt 4B").fill("123 MG Road");
  await page.getByPlaceholder("City").fill("Bengaluru");
  await page.getByPlaceholder("State").fill("Karnataka");
  await page.getByPlaceholder("000000").fill("560001");
  await page.getByRole("button", { name: /Use my location/i }).click();
  await page.getByRole("button", { name: /Apply captured location/i }).click();
  await page.getByRole("button", { name: /Save Address/i }).click();
  await expect(page.getByText("123 MG Road, Bengaluru, Karnataka 560001")).toBeVisible();
}

export async function placeOrder(page: Page, restaurantId: string): Promise<void> {
  await clearServerCart(page.request);
  await addMargheritaToCart(page, restaurantId);
  await ensureLocalAddress(page);

  await page.goto("/checkout");
  const placeOrderButton = page.getByRole("button", { name: /Place Order/i });
  await expect(placeOrderButton).toBeEnabled({ timeout: 20_000 });
  await placeOrderButton.click();

  await page.waitForURL(/\/order-processing/, { timeout: 20_000 });
  await expect(
    page.getByRole("heading", { name: "Order Placed Successfully!" }),
  ).toBeVisible({ timeout: 15_000 });
}
