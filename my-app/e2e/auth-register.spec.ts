import { test, expect } from "@playwright/test";
import {
  uniqueCustomer,
  registerViaForm,
  openAuthForm,
  type NewCustomer,
} from "./fixtures/seed";
import { getCurrentUserId, login } from "./fixtures/seed";
import { readOtp, fillOtp, flushRateLimits } from "./fixtures/seed";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await flushRateLimits();
});

test.describe("registration + OTP journey @regression", () => {
  let customer: NewCustomer;
  let userId: string;
  const newPassword = "Reset@5678";

  test("register → auto-login → verify email → verify phone → app", async ({ page }) => {
    customer = uniqueCustomer();
    await registerViaForm(page, customer);

    await page.waitForURL(/\/verify-email/, { timeout: 15_000 });
    userId = await getCurrentUserId(page);

    const emailCode = await readOtp("email-verify", userId);
    await fillOtp(page, emailCode);
    await page.getByRole("button", { name: "Verify Email" }).click();

    await page.waitForURL(/\/verify-phone/, { timeout: 15_000 });
    const phoneCode = await readOtp("phone-verify", userId);
    await fillOtp(page, phoneCode);
    await page.getByRole("button", { name: "Verify Phone" }).click();

    await page.waitForURL(
      (url) =>
        !/\/verify-(email|phone)/.test(url.pathname) &&
        !url.pathname.startsWith("/register") &&
        !url.pathname.startsWith("/login"),
      { timeout: 15_000 },
    );
    await expect(page).not.toHaveURL(/\/verify-(email|phone)|\/login|\/register/);
  });

  test("forgot password → reset with code → login with new password", async ({ page }) => {
    await openAuthForm(page, "Forgot password?", /\/forgot-password/);
    await page.getByLabel("Email address").fill(customer.email);
    await page.getByRole("button", { name: "Send Reset Code" }).click();

    await page.waitForURL(/\/reset-password/, { timeout: 15_000 });

    const resetCode = await readOtp("password-reset", userId);
    await fillOtp(page, resetCode);
    const passwords = page.locator('input[type="password"]');
    await passwords.first().fill(newPassword);
    await passwords.nth(1).fill(newPassword);
    await page.getByRole("button", { name: "Reset Password" }).click();

    await page.waitForURL(/\/login/, { timeout: 15_000 });
    await login(page, { email: customer.email, password: newPassword });
    await expect(page).not.toHaveURL(/\/login/);
  });
});
