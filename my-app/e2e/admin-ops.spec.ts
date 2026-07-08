import { test, expect, type Page } from "@playwright/test";
import { login } from "./fixtures/seed";
import { flushRateLimits } from "./fixtures/seed";
import { ADMIN_USER, TEST_USER } from "./fixtures/seed";
import { seedServiceableRestaurant } from "./fixtures/seed";
import {
  awaitCreatedFulfillment,
  firstMenuItem,
  placeCodOrder,
  provisionAdmin,
  seedCustomer,
  seedPendingReview,
} from "./fixtures/seed";

/**
 * Phase 11 Batch 11.3 — consolidated admin-ops regression against a live,
 * self-seeding server_2. Covers the three Phase 11 surfaces plus the
 * admin/non-admin tab-visibility split (the Batch 11.0 gate).
 *
 * Run with: npm run test:e2e -- admin-ops.spec.ts (needs the server_2 docker
 * stack on :3000 and its mongo/redis containers — seeding promotes an ADMIN and
 * inserts a PENDING review out of band, mirroring the Redis OTP fixture).
 *
 * `adminOps` defaults ON as of Batch 11.3, so no env flag is needed.
 *
 * Seeding strategy (beforeAll):
 *  - Promote `ADMIN_USER` to role ADMIN (no admin self-signup exists).
 *  - Seed one serviceable restaurant + a customer, place two COD orders → two
 *    `CREATED` fulfillments (one for reassign, one for cancel).
 *  - Insert a PENDING review for the moderation queue.
 * Reassign uses an explicit rider id: this build wires the available-rider
 * provider to an empty list (no rider read model yet), so auto-pick always
 * returns `no_available_rider` by design — an explicit rider exercises the
 * real offer path.
 */
test.describe.configure({ mode: "serial" });

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3100";

let restaurantId: string;
let fulfillmentToReassign: string;
let fulfillmentToCancel: string;
let reviewComment: string;

test.beforeAll(async ({ playwright }) => {
  test.setTimeout(180_000);
  await flushRateLimits();

  const request = await playwright.request.newContext({ baseURL: BASE_URL });
  try {
    await provisionAdmin(request);

    const restaurant = await seedServiceableRestaurant(request);
    restaurantId = restaurant.id;
    const { menuItemId, unitPrice } = await firstMenuItem(request, restaurantId);

    const customer = await seedCustomer(request);

    const orderA = await placeCodOrder(request, customer.bearer, restaurantId, menuItemId, unitPrice);
    fulfillmentToReassign = await awaitCreatedFulfillment(
      request,
      restaurantId,
      restaurant.ownerAccessToken,
      orderA,
    );

    const orderB = await placeCodOrder(request, customer.bearer, restaurantId, menuItemId, unitPrice);
    fulfillmentToCancel = await awaitCreatedFulfillment(
      request,
      restaurantId,
      restaurant.ownerAccessToken,
      orderB,
    );

    reviewComment = `E2E moderation ${Date.now()}`;
    await seedPendingReview(restaurantId, customer.customerId, reviewComment);
  } finally {
    await request.dispose();
  }
});

test.beforeEach(async () => {
  await flushRateLimits();
});

async function openAdminTab(page: Page, tabName: string): Promise<void> {
  await page.goto("/admin");
  await expect(page.getByText("Admin Dashboard")).toBeVisible();
  await page.getByRole("tab", { name: tabName }).click();
}

/** The dashboard/moderation Card carrying the given text — scopes row-level actions. */
function rowWith(page: Page, text: string) {
  return page.locator("div.border-2").filter({ hasText: text }).first();
}

test.describe("admin ops — moderation, fulfillment dashboard, queue, tab gating @regression", () => {
  test("(a) ADMIN approves the seeded pending review and it leaves the PENDING filter", async ({
    page,
  }) => {
    await login(page, ADMIN_USER);
    await openAdminTab(page, "Moderation");

    const row = rowWith(page, reviewComment);
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Approve", exact: true }).click();

    await expect(page.getByText("Review approved")).toBeVisible();
    await expect(page.getByText(reviewComment)).toHaveCount(0);
  });

  test("(b) ADMIN reassigns an active fulfillment", async ({ page }) => {
    await login(page, ADMIN_USER);
    await openAdminTab(page, "Orders");

    await page.getByLabel("Restaurant ID").fill(restaurantId);
    await page.getByRole("button", { name: "Apply" }).click();

    const row = rowWith(page, fulfillmentToReassign);
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Reassign", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Reassign rider" })).toBeVisible();
    await dialog.getByLabel("Rider ID (optional)").fill(`e2e-rider-${Date.now()}`);
    await dialog.getByRole("button", { name: "Reassign", exact: true }).click();

    await expect(page.getByText("Fulfillment reassigned")).toBeVisible();
  });

  test("(c) ADMIN cancels a fulfillment with a reason", async ({ page }) => {
    await login(page, ADMIN_USER);
    await openAdminTab(page, "Orders");

    await page.getByLabel("Restaurant ID").fill(restaurantId);
    await page.getByRole("button", { name: "Apply" }).click();

    const row = rowWith(page, fulfillmentToCancel);
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Cancel", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Cancel fulfillment" })).toBeVisible();
    await dialog.getByLabel("Reason").fill("E2E: kitchen closed");
    await dialog.getByRole("button", { name: "Cancel fulfillment", exact: true }).click();

    await expect(page.getByText("Fulfillment cancelled")).toBeVisible();
  });

  test("(d) owner sees only the Queue tab (not Moderation/Fulfillments) and its own restaurant", async ({
    page,
  }) => {
    await login(page, TEST_USER);
    await page.goto("/admin");
    await page.getByRole("tab", { name: "Restaurants" }).click();

    const restaurantName = `Queue Owner ${Date.now()}`;
    await page.getByRole("button", { name: "Add Restaurant" }).click();
    await page.getByLabel("Name *").fill(restaurantName);
    await page.getByLabel(/North Indian/i).check();
    await page.getByLabel("Street *").fill("9 Queue Lane");
    await page.getByLabel("City *").fill("Pune");
    await page.getByLabel("State *").fill("Maharashtra");
    await page.getByLabel("PIN code *").fill("411001");
    await page.getByLabel("Latitude *").fill("18.52");
    await page.getByLabel("Longitude *").fill("73.85");
    await page.getByLabel("Phone *").fill("+15551230000");
    await page.getByRole("button", { name: "Create Restaurant" }).click();
    await expect(page.getByRole("heading", { name: restaurantName })).toBeVisible();

    await expect(page.getByRole("tab", { name: "Moderation" })).toHaveCount(0);
    await page.getByRole("tab", { name: "Orders" }).click();
    await expect(page.getByText(/coming soon/i)).toBeVisible();
    await expect(page.getByLabel("Fulfillment status filter")).toHaveCount(0);

    await page.getByRole("tab", { name: "Queue" }).click();
    await page.getByLabel("Restaurant queue picker").click();
    await expect(page.getByRole("option", { name: restaurantName })).toBeVisible();
    await page.getByRole("option", { name: restaurantName }).click();
    await expect(page.getByText("No fulfillments in this queue.")).toBeVisible();
  });
});
