/**
 * Consolidated E2E seeding entrypoint (Phase 12, Batch 12.1).
 *
 * A single barrel over the per-phase fixture helpers so every `e2e/*.spec.ts`
 * imports its seeding from ONE place (`./fixtures/seed`) instead of reaching
 * into `auth` / `catalog` / `checkout` / `otp` / `register` / `adminOps`
 * directly. It introduces **no new seeding mechanism** — it re-exports the
 * existing helpers and exposes a named {@link Seeder} surface that maps onto
 * them.
 *
 * It also serves as Playwright's `globalSetup` (default export): it idempotently
 * provisions the two SHARED accounts the suite assumes pre-exist — the verified
 * CUSTOMER (`TEST_USER`, used by every `login(page)`) and the platform ADMIN
 * (`ADMIN_USER`). Per-spec data (restaurants, orders, reviews) stays seeded
 * inside each spec, namespaced with unique emails/ids, to avoid ordering
 * coupling — see the namespacing risk note in `integration_phases/Phase_12.md`.
 */
import path from "node:path";
import dotenv from "dotenv";
import { type APIRequestContext, request as playwrightRequest } from "@playwright/test";

import { provisionAdmin, seedVerifiedCustomer, seedCustomer, placeCodOrder, firstMenuItem, awaitCreatedFulfillment, seedPendingReview } from "./adminOps";
import { seedServiceableRestaurant } from "./checkout";

export * from "./auth";
export * from "./credentials";
export * from "./catalog";
export * from "./checkout";
export * from "./otp";
export * from "./register";
export * from "./adminOps";

/**
 * Place a real COD order and resolve the fulfillment auto-created off the
 * checkout outbox, returning the linkage ids the review/tracking specs need.
 *
 * FROZEN-BACKEND NOTE: `CREATED` is the terminal state reachable from a
 * black-box run — advancing a fulfillment to `DELIVERED` hits server_2's frozen
 * owner-gated transition wall (`userId === fulfillment.restaurantId`), and there
 * is no rider fixture. A genuinely *delivered* state (for the moderation queue)
 * is seeded out-of-band via {@link seedPendingReview}. Documented in
 * `reviews.spec.ts`.
 */
export async function seedCompletedFulfillment(
  request: APIRequestContext,
): Promise<{ restaurantId: string; orderRequestId: string; fulfillmentId: string }> {
  const restaurant = await seedServiceableRestaurant(request);
  const { bearer } = await seedCustomer(request);
  const { menuItemId, unitPrice } = await firstMenuItem(request, restaurant.id);
  const orderRequestId = await placeCodOrder(request, bearer, restaurant.id, menuItemId, unitPrice);
  const fulfillmentId = await awaitCreatedFulfillment(
    request,
    restaurant.id,
    restaurant.ownerAccessToken,
    orderRequestId,
  );
  return { restaurantId: restaurant.id, orderRequestId, fulfillmentId };
}

/**
 * The named seeding surface. Each method wraps an existing fixture helper — this
 * is the documented "one Seeder" the regression suite seeds through.
 */
export const Seeder = {
  /** Shared verified CUSTOMER (`TEST_USER`) — idempotent. */
  seedVerifiedCustomer,
  /** Shared platform ADMIN (`ADMIN_USER`) — idempotent. */
  seedAdmin: provisionAdmin,
  /** A published + serviceable restaurant with one menu item + delivery zone. */
  seedServiceableRestaurant,
  /** A placed COD order + its (CREATED) fulfillment — see the note above. */
  seedCompletedFulfillment,
  /** A PENDING review row for the moderation queue (direct DB insert). */
  seedPendingReview,
} as const;

const PROXY_TARGET = process.env.API_PROXY_TARGET ?? "http://localhost:3000";

/**
 * Playwright `globalSetup`: seed the shared accounts once per run, directly
 * against server_2 (the dev app's `/api/v1` proxy may not be up yet when this
 * runs). Idempotent — safe to re-run against an already-seeded stack.
 */
export default async function globalSetup(): Promise<void> {
  dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

  const request = await playwrightRequest.newContext({ baseURL: PROXY_TARGET });
  try {
    await Seeder.seedVerifiedCustomer(request);
    await Seeder.seedAdmin(request);
  } finally {
    await request.dispose();
  }
}
