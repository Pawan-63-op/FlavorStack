import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { type APIRequestContext, expect } from "@playwright/test";
import { ADMIN_USER, TEST_USER } from "./credentials";
import { SEED_LAT, SEED_LNG } from "./checkout";

const exec = promisify(execFile);

/** Mongo container running server_2's primary (compose default name). */
const MONGO_CONTAINER = process.env.E2E_MONGO_CONTAINER ?? "server_2-mongo-1";
const MONGO_DB = process.env.E2E_MONGO_DB ?? "flavorstack";

/**
 * Run a mongosh script against server_2's database via `docker exec` — same
 * out-of-band seeding pattern as `otp.ts`'s Redis access. Used only to (a)
 * promote a user to ADMIN (no admin self-signup exists) and (b) insert a
 * PENDING review directly (reaching one through the real flow needs a delivered
 * order, blocked by server_2's frozen owner-gated transitions).
 */
async function mongoEval(script: string): Promise<string> {
  const { stdout } = await exec("docker", [
    "exec",
    MONGO_CONTAINER,
    "mongosh",
    MONGO_DB,
    "--quiet",
    "--eval",
    script,
  ]);
  return stdout.trim();
}

/**
 * Ensure the seeded ADMIN account (`ADMIN_USER`) exists with role ADMIN.
 * Registers a fresh CUSTOMER (idempotent — ignores the conflict on re-runs),
 * then promotes the doc in the single discriminated `users` collection and
 * back-fills the ADMIN discriminator fields the mapper requires.
 */
export async function provisionAdmin(request: APIRequestContext): Promise<void> {
  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const phone = `+91${unique.slice(-9).padStart(9, "9")}1`;

  await request.post("/api/v1/auth/register", {
    data: {
      role: "CUSTOMER",
      customer: {
        name: "Platform Admin",
        email: ADMIN_USER.email,
        phone,
        password: ADMIN_USER.password,
        address: {
          street: "1 Admin Way",
          city: "Bengaluru",
          state: "Karnataka",
          pinCode: "560001",
          lat: SEED_LAT,
          lng: SEED_LNG,
        },
      },
    },
  });

  const script = `db.users.updateOne(
    { email: "${ADMIN_USER.email}" },
    { $set: {
      role: "ADMIN",
      department: "ops",
      isSuperAdmin: true,
      managedBy: null,
      permissions: [],
      twoFactorEnabled: false,
      twoFactorSecret: null,
      auditLog: [],
      lastActivityAt: null,
      isEmailVerified: true
    } }
  ).modifiedCount`;
  await mongoEval(script);
}

/**
 * Ensure the shared verified CUSTOMER (`TEST_USER`) every `login(page)` relies
 * on exists. Registers the account via the public API (idempotent — re-runs
 * 409 on the duplicate email and are ignored), then flips `isEmailVerified`
 * directly in Mongo — the same out-of-band mechanism `provisionAdmin` uses, and
 * the documented manual seed step from `e2e/README.md`. Phase 1 has no
 * verification flow, so without this flag the protected-layout guard
 * (`user.isVerified === false → /verify-email`) would bounce the login.
 *
 * Wired through `e2e/fixtures/seed.ts`'s `globalSetup` so the suite is
 * self-seeding rather than depending on a manual pre-seed.
 */
export async function seedVerifiedCustomer(request: APIRequestContext): Promise<void> {
  await request.post("/api/v1/auth/register", {
    data: {
      role: "CUSTOMER",
      customer: {
        name: "Test Customer",
        email: TEST_USER.email,
        phone: "+919876500001",
        password: TEST_USER.password,
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

  const script = `db.users.updateOne(
    { email: "${TEST_USER.email}" },
    { $set: { isEmailVerified: true } }
  ).matchedCount`;
  await mongoEval(script);
}

/** Resolve the first available menu item id + its unit price for a seeded restaurant. */
export async function firstMenuItem(
  request: APIRequestContext,
  restaurantId: string,
): Promise<{ menuItemId: string; unitPrice: { amount: number; currency: string } }> {
  const res = await request.get(`/api/v1/catalog/restaurants/${restaurantId}/menu`);
  const body = (await res.json()) as {
    categories?: { items?: MenuItemDto[] }[];
    items?: MenuItemDto[];
  };
  const items = [
    ...(body.items ?? []),
    ...((body.categories ?? []).flatMap((c) => c.items ?? [])),
  ];
  const item = items[0];
  if (!item) throw new Error(`no menu item found for restaurant ${restaurantId}`);
  return { menuItemId: item.id, unitPrice: item.basePrice ?? { amount: 29999, currency: "INR" } };
}

interface MenuItemDto {
  id: string;
  basePrice?: { amount: number; currency: string };
}

/**
 * Place a COD order via API for an authenticated customer: add the item to the
 * cart, then checkout. COD needs no payment gateway, so the order request
 * commits immediately and the fulfillment worker auto-creates a `CREATED`
 * fulfillment off the outbox. Returns the order request id.
 */
export async function placeCodOrder(
  request: APIRequestContext,
  bearer: string,
  restaurantId: string,
  menuItemId: string,
  unitPrice: { amount: number; currency: string },
): Promise<string> {
  const headers = { Authorization: `Bearer ${bearer}` };

  await request.delete("/api/v1/cart", { headers });
  const addRes = await request.post("/api/v1/cart/items", {
    headers,
    data: { restaurantId, menuItemId, quantity: 1, unitPrice },
  });
  if (!addRes.ok()) {
    throw new Error(`add to cart failed: ${addRes.status()} ${await addRes.text()}`);
  }

  const addressId = await ensureSavedAddress(request, bearer);

  const checkoutRes = await request.post("/api/v1/checkout", {
    headers: { ...headers, "Idempotency-Key": randomUUID() },
    data: { paymentMethod: "COD", addressId },
  });
  if (!checkoutRes.ok()) {
    throw new Error(`checkout failed: ${checkoutRes.status()} ${await checkoutRes.text()}`);
  }
  const body = (await checkoutRes.json()) as { orderRequestId: string };
  return body.orderRequestId;
}

/**
 * Resolve the customer's saved delivery address id, creating one when the account has
 * none. `/checkout` takes an `addressId` and resolves the address (and so the delivery
 * fee) server-side, so a client-supplied address is no longer the contract.
 */
export async function ensureSavedAddress(
  request: APIRequestContext,
  bearer: string,
): Promise<string> {
  const headers = { Authorization: `Bearer ${bearer}` };

  const listRes = await request.get("/api/v1/users/me/addresses", { headers });
  if (!listRes.ok()) {
    throw new Error(`list addresses failed: ${listRes.status()} ${await listRes.text()}`);
  }
  const existing = (await listRes.json()) as Array<{ id: string; isDefault: boolean }>;
  if (existing.length > 0) {
    return (existing.find((a) => a.isDefault) ?? existing[0]).id;
  }

  const createRes = await request.post("/api/v1/users/me/addresses", {
    headers,
    data: {
      label: "Home",
      street: "123 MG Road",
      city: "Bengaluru",
      state: "Karnataka",
      pinCode: "560001",
      coordinates: { lat: SEED_LAT, lng: SEED_LNG },
    },
  });
  if (!createRes.ok()) {
    throw new Error(`create address failed: ${createRes.status()} ${await createRes.text()}`);
  }
  const created = (await createRes.json()) as { id: string };
  return created.id;
}

/**
 * Poll the owner's CREATED fulfillment queue until the fulfillment auto-created
 * for `orderRequestId` appears (the projection lags the checkout commit).
 */
export async function awaitCreatedFulfillment(
  request: APIRequestContext,
  restaurantId: string,
  ownerBearer: string,
  orderRequestId: string,
): Promise<string> {
  const headers = { Authorization: `Bearer ${ownerBearer}` };
  let fulfillmentId: string | undefined;
  await expect
    .poll(
      async () => {
        const res = await request.get(
          `/api/v1/restaurants/${restaurantId}/fulfillments?status=CREATED`,
          { headers },
        );
        if (!res.ok()) return false;
        const rows = (await res.json()) as { fulfillmentId: string; orderRequestId: string }[];
        fulfillmentId = rows.find((f) => f.orderRequestId === orderRequestId)?.fulfillmentId;
        return Boolean(fulfillmentId);
      },
      { timeout: 30_000, intervals: [500, 1000, 2000] },
    )
    .toBe(true);
  return fulfillmentId as string;
}

/** Register + log in a fresh CUSTOMER via API; returns their bearer token + id. */
export async function seedCustomer(
  request: APIRequestContext,
): Promise<{ bearer: string; customerId: string }> {
  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `e2e.adminops.cust.${unique}@flavorstack.local`;
  const phone = `+91${unique.slice(-9).padStart(9, "9")}2`;

  await request.post("/api/v1/auth/register", {
    data: {
      role: "CUSTOMER",
      customer: {
        name: "AdminOps Customer",
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

  const loginRes = await request.post("/api/v1/auth/login", {
    data: { email, password: "Test@1234" },
  });
  const { accessToken } = (await loginRes.json()) as { accessToken: string };
  const meRes = await request.get("/api/v1/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const { id } = (await meRes.json()) as { id: string };
  return { bearer: accessToken, customerId: id };
}

/** Insert a PENDING review directly so the moderation queue has a row to approve. */
export async function seedPendingReview(
  restaurantId: string,
  customerId: string,
  comment: string,
): Promise<{ reviewId: string; fulfillmentId: string }> {
  const reviewId = randomUUID();
  const fulfillmentId = randomUUID();
  const script = `db.reviews.insertOne({
    _id: "${reviewId}",
    customerId: "${customerId}",
    restaurantId: "${restaurantId}",
    fulfillmentId: "${fulfillmentId}",
    restaurantRating: 4,
    deliveryRating: 5,
    comment: ${JSON.stringify(comment)},
    moderationStatus: "PENDING",
    createdAt: new Date()
  }).acknowledged`;
  await mongoEval(script);
  return { reviewId, fulfillmentId };
}
