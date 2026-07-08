import { describe, expect, it } from "vitest";
import {
  loginSchema,
  registerSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  phoneSchema,
  codeSchema,
  registerWithPhoneSchema,
  resetPasswordWithCodeSchema,
} from "./auth";

describe("legacy schemas (untouched — still consumed by unmigrated components)", () => {
  it("loginSchema still accepts a valid login", () => {
    expect(
      loginSchema.safeParse({ email: "jane@example.com", password: "secret" }).success,
    ).toBe(true);
  });

  it("registerSchema still has no phone field (legacy shape)", () => {
    const result = registerSchema.safeParse({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "secret1",
      confirmPassword: "secret1",
    });
    expect(result.success).toBe(true);
  });

  it("verifyEmailSchema still uses the `otp` field", () => {
    expect(verifyEmailSchema.safeParse({ otp: "123456" }).success).toBe(true);
  });

  it("resetPasswordSchema still uses the `otp` field", () => {
    const result = resetPasswordSchema.safeParse({
      otp: "123456",
      newPassword: "secret1",
      confirmPassword: "secret1",
    });
    expect(result.success).toBe(true);
  });

  it("forgotPasswordSchema unchanged", () => {
    expect(forgotPasswordSchema.safeParse({ email: "jane@example.com" }).success).toBe(true);
  });
});

describe("phoneSchema (new — E.164)", () => {
  it("accepts a valid E.164 phone", () => {
    expect(phoneSchema.safeParse({ phone: "+15551234567" }).success).toBe(true);
  });

  it.each(["5551234567", "+0551234567", "+1234567", "not-a-phone"])(
    "rejects invalid phone %s",
    (phone) => {
      expect(phoneSchema.safeParse({ phone }).success).toBe(false);
    },
  );
});

describe("codeSchema (new — 6-digit code)", () => {
  it("accepts a 6-digit numeric code", () => {
    expect(codeSchema.safeParse({ code: "123456" }).success).toBe(true);
  });

  it.each(["12345", "1234567", "12345a", ""])("rejects invalid code %s", (code) => {
    expect(codeSchema.safeParse({ code }).success).toBe(false);
  });
});

describe("registerWithPhoneSchema (new — mirrors backend register validation)", () => {
  const valid = {
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "+15551234567",
    password: "Sup3r$ecret1",
    confirmPassword: "Sup3r$ecret1",
  };

  it("accepts a fully valid payload", () => {
    expect(registerWithPhoneSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a non-E.164 phone", () => {
    expect(
      registerWithPhoneSchema.safeParse({ ...valid, phone: "555-1234" }).success,
    ).toBe(false);
  });

  it.each([
    ["short", "weak1$"],
    ["missing uppercase", "weakpassword1$"],
    ["missing digit", "WeakPassword$"],
    ["missing special char", "WeakPassword1"],
  ])("rejects a weak password (%s)", (_label, password) => {
    expect(
      registerWithPhoneSchema.safeParse({
        ...valid,
        password,
        confirmPassword: password,
      }).success,
    ).toBe(false);
  });

  it("rejects mismatched confirmPassword", () => {
    expect(
      registerWithPhoneSchema.safeParse({ ...valid, confirmPassword: "Different1$" }).success,
    ).toBe(false);
  });
});

describe("resetPasswordWithCodeSchema (new — code + strong password)", () => {
  const valid = {
    code: "123456",
    newPassword: "Sup3r$ecret1",
    confirmPassword: "Sup3r$ecret1",
  };

  it("accepts a fully valid payload", () => {
    expect(resetPasswordWithCodeSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a non-6-digit code", () => {
    expect(
      resetPasswordWithCodeSchema.safeParse({ ...valid, code: "123" }).success,
    ).toBe(false);
  });

  it("rejects a weak newPassword", () => {
    expect(
      resetPasswordWithCodeSchema.safeParse({
        ...valid,
        newPassword: "weak",
        confirmPassword: "weak",
      }).success,
    ).toBe(false);
  });

  it("rejects mismatched confirmPassword", () => {
    expect(
      resetPasswordWithCodeSchema.safeParse({ ...valid, confirmPassword: "Different1$" }).success,
    ).toBe(false);
  });
});
