import { type Page } from "@playwright/test";

/** A fresh customer for the register journey (server_2 register payload fields). */
export interface NewCustomer {
  name: string;
  email: string;
  phone: string;
  password: string;
}

/**
 * Unique-per-run customer so repeated E2E runs don't collide on
 * email/phone uniqueness (and email-keyed rate limits stay fresh). Phone is
 * E.164 (`+1` + 10 digits); password satisfies server_2's strong-password rule.
 */
export function uniqueCustomer(): NewCustomer {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    name: "E2E Customer",
    email: `e2e-${stamp}@flavorstack.local`,
    phone: `+1${stamp.slice(-10)}`,
    password: "Test@1234",
  };
}

/**
 * Open a public auth form the way a real user does — by client-navigating from
 * /login. A *full* page load of a logged-out public route triggers the bootstrap
 * (`checkAuth → /users/me 401 → /auth/refresh 401 → auth:expired`) which
 * `ClientInit` turns into a redirect to /login; starting on /login (where that
 * bounce is a no-op) and clicking through avoids racing the form.
 */
export async function openAuthForm(
  page: Page,
  linkName: string,
  urlPattern: RegExp,
): Promise<void> {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: linkName }).click();
  await page.waitForURL(urlPattern);
}

/** Fill and submit the real register form (drives store register → auto-login). */
export async function registerViaForm(page: Page, c: NewCustomer): Promise<void> {
  await openAuthForm(page, "Sign up", /\/register/);
  await page.getByLabel("Full Name").fill(c.name);
  await page.getByLabel("Email").fill(c.email);
  await page.getByLabel("Phone").fill(c.phone);
  const passwords = page.locator('input[type="password"]');
  await passwords.first().fill(c.password);
  await passwords.nth(1).fill(c.password);
  await page.getByRole("button", { name: "Create Account" }).click();
}
