import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserResponse } from "../adapters/user";
import { client } from "../client/http";
import { authService } from "./auth";

vi.mock("../client/http", () => ({
  client: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
    raw: vi.fn(),
  },
}));

function makeUserResponse(overrides: Partial<UserResponse> = {}): UserResponse {
  return {
    id: "u1",
    name: "Jane Doe",
    email: "jane@example.com",
    role: "CUSTOMER",
    isEmailVerified: true,
    avatarUrl: "https://example.com/avatar.png",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("authService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("login", () => {
    it("POSTs credentials to /auth/login and returns the adapted user", async () => {
      const dto = makeUserResponse();
      vi.mocked(client.post).mockResolvedValue({
        user: dto,
        accessToken: "at",
        refreshToken: "rt",
        expiresIn: 900,
      });

      const result = await authService.login({
        email: "jane@example.com",
        password: "secret",
      });

      expect(client.post).toHaveBeenCalledWith("/auth/login", {
        body: { email: "jane@example.com", password: "secret" },
      });
      expect(result).toEqual({
        _id: "u1",
        id: "u1",
        name: "Jane Doe",
        email: "jane@example.com",
        role: "CUSTOMER",
        isVerified: true,
        avatar: "https://example.com/avatar.png",
        isAdmin: false,
        createdAt: "2026-01-01T00:00:00.000Z",
      });
    });
  });

  describe("me", () => {
    it("GETs /users/me and returns the adapted user", async () => {
      const dto = makeUserResponse({ role: "ADMIN" });
      vi.mocked(client.get).mockResolvedValue(dto);

      const result = await authService.me();

      expect(client.get).toHaveBeenCalledWith("/users/me");
      expect(result.isAdmin).toBe(true);
      expect(result.id).toBe("u1");
    });
  });

  describe("updateMe", () => {
    it("PATCHes /users/me sending only name and avatarUrl", async () => {
      const dto = makeUserResponse({ name: "New Name" });
      vi.mocked(client.patch).mockResolvedValue(dto);

      await authService.updateMe({
        name: "New Name",
        avatarUrl: "https://example.com/new.png",
      } as { name?: string; avatarUrl?: string });

      expect(client.patch).toHaveBeenCalledWith("/users/me", {
        body: { name: "New Name", avatarUrl: "https://example.com/new.png" },
      });
    });

    it("drops unsupported fields before sending", async () => {
      const dto = makeUserResponse();
      vi.mocked(client.patch).mockResolvedValue(dto);

      await authService.updateMe({
        name: "New Name",
        phone: "555-1234",
        bio: "should not be sent",
      });

      expect(client.patch).toHaveBeenCalledWith("/users/me", {
        body: { name: "New Name" },
      });
    });

    it("returns the adapted user", async () => {
      const dto = makeUserResponse({ name: "New Name" });
      vi.mocked(client.patch).mockResolvedValue(dto);

      const result = await authService.updateMe({ name: "New Name" });

      expect(result.name).toBe("New Name");
    });
  });

  describe("logout", () => {
    it("POSTs /auth/logout and resolves on 204/empty response", async () => {
      vi.mocked(client.post).mockResolvedValue(undefined);

      await expect(authService.logout()).resolves.toBeUndefined();
      expect(client.post).toHaveBeenCalledWith("/auth/logout");
    });
  });

  describe("register", () => {
    it("POSTs the role-discriminated payload to /auth/register and returns the adapted user", async () => {
      const dto = makeUserResponse({ isEmailVerified: false });
      vi.mocked(client.post).mockResolvedValue({
        user: dto,
        accessToken: "",
        refreshToken: "",
        expiresIn: 0,
      });

      const result = await authService.register({
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "+15551234567",
        password: "Sup3r$ecret",
      });

      expect(client.post).toHaveBeenCalledWith("/auth/register", {
        body: {
          role: "CUSTOMER",
          customer: {
            name: "Jane Doe",
            email: "jane@example.com",
            phone: "+15551234567",
            password: "Sup3r$ecret",
          },
        },
      });
      expect(result.isVerified).toBe(false);
    });

    it("propagates errors from the client", async () => {
      vi.mocked(client.post).mockRejectedValue(new Error("conflict"));

      await expect(
        authService.register({
          name: "Jane Doe",
          email: "jane@example.com",
          phone: "+15551234567",
          password: "Sup3r$ecret",
        }),
      ).rejects.toThrow("conflict");
    });
  });

  describe("sendEmailOtp", () => {
    it("POSTs /auth/email-otp/send and resolves on 204", async () => {
      vi.mocked(client.post).mockResolvedValue(undefined);

      await expect(authService.sendEmailOtp()).resolves.toBeUndefined();
      expect(client.post).toHaveBeenCalledWith("/auth/email-otp/send");
    });
  });

  describe("verifyEmailOtp", () => {
    it("POSTs the code to /auth/email-otp/verify and resolves on 204", async () => {
      vi.mocked(client.post).mockResolvedValue(undefined);

      await expect(authService.verifyEmailOtp("123456")).resolves.toBeUndefined();
      expect(client.post).toHaveBeenCalledWith("/auth/email-otp/verify", {
        body: { code: "123456" },
      });
    });
  });

  describe("sendPhoneOtp", () => {
    it("POSTs the phone to /auth/phone-otp/send and resolves on 204", async () => {
      vi.mocked(client.post).mockResolvedValue(undefined);

      await expect(authService.sendPhoneOtp("+15551234567")).resolves.toBeUndefined();
      expect(client.post).toHaveBeenCalledWith("/auth/phone-otp/send", {
        body: { phone: "+15551234567" },
      });
    });
  });

  describe("verifyPhoneOtp", () => {
    it("POSTs the code to /auth/phone-otp/verify and resolves on 204", async () => {
      vi.mocked(client.post).mockResolvedValue(undefined);

      await expect(authService.verifyPhoneOtp("654321")).resolves.toBeUndefined();
      expect(client.post).toHaveBeenCalledWith("/auth/phone-otp/verify", {
        body: { code: "654321" },
      });
    });
  });

  describe("forgotPassword", () => {
    it("POSTs the email to /auth/forgot-password and resolves on 204", async () => {
      vi.mocked(client.post).mockResolvedValue(undefined);

      await expect(authService.forgotPassword("jane@example.com")).resolves.toBeUndefined();
      expect(client.post).toHaveBeenCalledWith("/auth/forgot-password", {
        body: { email: "jane@example.com" },
      });
    });
  });

  describe("resetPassword", () => {
    it("POSTs email/code/newPassword to /auth/reset-password and resolves on 204", async () => {
      vi.mocked(client.post).mockResolvedValue(undefined);

      await expect(
        authService.resetPassword({
          email: "jane@example.com",
          code: "111222",
          newPassword: "Sup3r$ecret2",
        }),
      ).resolves.toBeUndefined();
      expect(client.post).toHaveBeenCalledWith("/auth/reset-password", {
        body: {
          email: "jane@example.com",
          code: "111222",
          newPassword: "Sup3r$ecret2",
        },
      });
    });
  });
});
