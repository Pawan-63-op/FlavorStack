import { type Page, expect } from "@playwright/test";
import { TEST_USER, type TestUser } from "./credentials";

/** httpOnly session cookie set by server_2 on login (path `/`, 15 min). */
export const ACCESS_TOKEN_COOKIE = "access_token";
/** httpOnly refresh cookie (path `/api/v1/auth/refresh`, 30 d). */
export const REFRESH_TOKEN_COOKIE = "refresh_token";

/**
 * Drive the real login form and wait until the guard hands us a protected
 * route. Mirrors a user signing in — no API shortcuts — so the cookie/session
 * wiring is exercised end-to-end.
 */
export async function login(page: Page, user: TestUser = TEST_USER): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.getByRole("button", { name: "Sign In" }).click();

  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 15_000,
  });
}

/** True when the named auth cookie is present in the browser context. */
export async function hasCookie(page: Page, name: string): Promise<boolean> {
  const cookies = await page.context().cookies();
  return cookies.some((c) => c.name === name);
}

/** Assert we are sitting on the login screen (logged out / redirected). */
export async function expectOnLogin(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/login/);
}

/**
 * Resolve the current session's user id via `/users/me` (shares the page's
 * cookies through the dev proxy). This id is the key suffix for the Redis OTPs
 * (`otp:<purpose>:<id>`) — it equals `UserResponse.id` / the Mongo `_id`.
 */
export async function getCurrentUserId(page: Page): Promise<string> {
  const res = await page.request.get("/api/v1/users/me");
  if (!res.ok()) {
    throw new Error(`/users/me returned ${res.status()} resolving userId`);
  }
  const body = (await res.json()) as { id: string };
  return body.id;
}
