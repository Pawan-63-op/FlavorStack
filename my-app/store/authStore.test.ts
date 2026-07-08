import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/lib/api/adapters/user";
import { authService } from "@/lib/api/services/auth";
import { emitAuthExpired } from "@/lib/api/client/authEvents";
import { useAuthStore, subscribeAuthExpiry } from "./authStore";

vi.mock("@/lib/api/services/auth", () => ({
  authService: {
    login: vi.fn(),
    me: vi.fn(),
    updateMe: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    sendEmailOtp: vi.fn(),
    verifyEmailOtp: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    sendPhoneOtp: vi.fn(),
    verifyPhoneOtp: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function makeUser(overrides: Partial<User> = {}): User {
  return {
    _id: "u1",
    id: "u1",
    name: "Jane Doe",
    email: "jane@example.com",
    role: "CUSTOMER",
    isVerified: true,
    avatar: "https://example.com/avatar.png",
    isAdmin: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const INITIAL = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  curr_email: undefined,
  curr_phone: undefined,
  profileExtras: {},
};

describe("authStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState(INITIAL);
    localStorage.clear();
  });

  describe("login", () => {
    it("sets the adapted user and authenticated flag on success", async () => {
      vi.mocked(authService.login).mockResolvedValue(makeUser());

      await useAuthStore.getState().login("jane@example.com", "secret");

      expect(authService.login).toHaveBeenCalledWith({
        email: "jane@example.com",
        password: "secret",
      });
      const state = useAuthStore.getState();
      expect(state.user?._id).toBe("u1");
      expect(state.user?.name).toBe("Jane Doe");
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it("clears loading and rethrows on failure", async () => {
      vi.mocked(authService.login).mockRejectedValue(new Error("bad creds"));

      await expect(
        useAuthStore.getState().login("jane@example.com", "wrong"),
      ).rejects.toThrow("bad creds");

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.user).toBeNull();
    });
  });

  describe("checkAuth", () => {
    it("populates the user from /users/me on success", async () => {
      vi.mocked(authService.me).mockResolvedValue(makeUser({ role: "ADMIN", isAdmin: true }));

      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(authService.me).toHaveBeenCalledOnce();
      expect(state.user?.isAdmin).toBe(true);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it("clears the session on failure", async () => {
      useAuthStore.setState({ user: makeUser(), isAuthenticated: true });
      vi.mocked(authService.me).mockRejectedValue(new Error("401"));

      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });

  describe("fetchUserProfile", () => {
    it("reads /users/me via authService.me", async () => {
      vi.mocked(authService.me).mockResolvedValue(makeUser({ name: "Refreshed" }));

      await useAuthStore.getState().fetchUserProfile();

      expect(authService.me).toHaveBeenCalledOnce();
      expect(useAuthStore.getState().user?.name).toBe("Refreshed");
    });
  });

  describe("updateProfile", () => {
    it("sends only name and avatarUrl to the server", async () => {
      useAuthStore.setState({ user: makeUser() });
      vi.mocked(authService.updateMe).mockResolvedValue(makeUser({ name: "New Name" }));

      await useAuthStore.getState().updateProfile({
        name: "New Name",
        avatar: "https://example.com/new.png",
        phone: "555-1234",
        bio: "local bio",
      });

      expect(authService.updateMe).toHaveBeenCalledWith({
        name: "New Name",
        avatarUrl: "https://example.com/new.png",
      });
    });

    it("persists local-only fields in profileExtras and merges them onto the user", async () => {
      useAuthStore.setState({ user: makeUser() });
      vi.mocked(authService.updateMe).mockResolvedValue(makeUser({ name: "New Name" }));

      await useAuthStore.getState().updateProfile({
        name: "New Name",
        phone: "555-1234",
        bio: "local bio",
      });

      const state = useAuthStore.getState();
      expect(state.profileExtras.phone).toBe("555-1234");
      expect(state.profileExtras.bio).toBe("local bio");
      expect(state.user?.phone).toBe("555-1234");
      expect(state.user?.bio).toBe("local bio");
      expect(state.user?.name).toBe("New Name");
    });

    it("does not call the server when only local fields change", async () => {
      useAuthStore.setState({ user: makeUser() });

      await useAuthStore.getState().updateProfile({ phone: "555-9999" });

      expect(authService.updateMe).not.toHaveBeenCalled();
      expect(useAuthStore.getState().profileExtras.phone).toBe("555-9999");
    });
  });

  describe("logout", () => {
    it("clears state and persisted storage", async () => {
      useAuthStore.setState({ user: makeUser(), isAuthenticated: true });
      localStorage.setItem("auth-session-storage", "{}");
      vi.mocked(authService.logout).mockResolvedValue(undefined);

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(authService.logout).toHaveBeenCalledOnce();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(localStorage.getItem("auth-session-storage")).toBeNull();
    });

    it("clears local state even if the server logout fails", async () => {
      useAuthStore.setState({ user: makeUser(), isAuthenticated: true });
      vi.mocked(authService.logout).mockRejectedValue(new Error("network"));

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe("forgotPassword", () => {
    it("calls authService.forgotPassword with the email and clears loading on success", async () => {
      vi.mocked(authService.forgotPassword).mockResolvedValue(undefined);

      await useAuthStore.getState().forgotPassword("jane@example.com");

      expect(authService.forgotPassword).toHaveBeenCalledWith("jane@example.com");
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it("clears loading and rethrows on failure", async () => {
      vi.mocked(authService.forgotPassword).mockRejectedValue(new Error("rate limited"));

      await expect(
        useAuthStore.getState().forgotPassword("jane@example.com"),
      ).rejects.toThrow("rate limited");

      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe("resetPassword", () => {
    it("calls authService.resetPassword with email/code/newPassword and clears loading on success", async () => {
      vi.mocked(authService.resetPassword).mockResolvedValue(undefined);

      await useAuthStore
        .getState()
        .resetPassword("jane@example.com", "123456", "Sup3r$ecret1");

      expect(authService.resetPassword).toHaveBeenCalledWith({
        email: "jane@example.com",
        code: "123456",
        newPassword: "Sup3r$ecret1",
      });
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it("clears loading and rethrows on failure", async () => {
      vi.mocked(authService.resetPassword).mockRejectedValue(new Error("invalid code"));

      await expect(
        useAuthStore.getState().resetPassword("jane@example.com", "000000", "Sup3r$ecret1"),
      ).rejects.toThrow("invalid code");

      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe("register", () => {
    const input = {
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "+14155552671",
      password: "Sup3r$ecret1",
    };

    it("registers then auto-logs-in (in that order) and stores email + phone", async () => {
      vi.mocked(authService.register).mockResolvedValue(makeUser({ isVerified: false }));
      vi.mocked(authService.login).mockResolvedValue(makeUser({ isVerified: false }));

      await useAuthStore.getState().register(input);

      expect(authService.register).toHaveBeenCalledWith(input);
      expect(authService.login).toHaveBeenCalledWith({
        email: input.email,
        password: input.password,
      });
      expect(vi.mocked(authService.register).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(authService.login).mock.invocationCallOrder[0],
      );

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.curr_email).toBe(input.email);
      expect(state.curr_phone).toBe(input.phone);
    });

    it("does not auto-login and rethrows if register fails", async () => {
      vi.mocked(authService.register).mockRejectedValue(new Error("email_already_registered"));

      await expect(useAuthStore.getState().register(input)).rejects.toThrow(
        "email_already_registered",
      );

      expect(authService.login).not.toHaveBeenCalled();
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });

  describe("verifyEmail", () => {
    it("verifies the code then refreshes the user from /users/me", async () => {
      useAuthStore.setState({ user: makeUser({ isVerified: false }), isAuthenticated: true });
      vi.mocked(authService.verifyEmailOtp).mockResolvedValue(undefined);
      vi.mocked(authService.me).mockResolvedValue(makeUser({ isVerified: true }));

      await useAuthStore.getState().verifyEmail("123456");

      expect(authService.verifyEmailOtp).toHaveBeenCalledWith("123456");
      expect(authService.me).toHaveBeenCalledOnce();
      expect(vi.mocked(authService.verifyEmailOtp).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(authService.me).mock.invocationCallOrder[0],
      );

      const state = useAuthStore.getState();
      expect(state.user?.isVerified).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it("clears loading and rethrows on a bad code", async () => {
      vi.mocked(authService.verifyEmailOtp).mockRejectedValue(new Error("invalid_code"));

      await expect(useAuthStore.getState().verifyEmail("000000")).rejects.toThrow(
        "invalid_code",
      );

      expect(authService.me).not.toHaveBeenCalled();
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe("resendOtp", () => {
    it("sends the email OTP via the authed endpoint (no email arg)", async () => {
      vi.mocked(authService.sendEmailOtp).mockResolvedValue(undefined);

      await useAuthStore.getState().resendOtp();

      expect(authService.sendEmailOtp).toHaveBeenCalledOnce();
      expect(authService.sendEmailOtp).toHaveBeenCalledWith();
    });

    it("rethrows on failure", async () => {
      vi.mocked(authService.sendEmailOtp).mockRejectedValue(new Error("rate_limited"));

      await expect(useAuthStore.getState().resendOtp()).rejects.toThrow("rate_limited");
    });
  });

  describe("sendPhoneOtp", () => {
    it("sends the phone OTP for the given phone via the authed endpoint", async () => {
      vi.mocked(authService.sendPhoneOtp).mockResolvedValue(undefined);

      await useAuthStore.getState().sendPhoneOtp("+14155552671");

      expect(authService.sendPhoneOtp).toHaveBeenCalledWith("+14155552671");
    });

    it("rethrows on failure", async () => {
      vi.mocked(authService.sendPhoneOtp).mockRejectedValue(new Error("rate_limited"));

      await expect(
        useAuthStore.getState().sendPhoneOtp("+14155552671"),
      ).rejects.toThrow("rate_limited");
    });
  });

  describe("verifyPhoneOtp", () => {
    it("verifies the code and clears curr_phone (journey complete)", async () => {
      useAuthStore.setState({ curr_phone: "+14155552671" });
      vi.mocked(authService.verifyPhoneOtp).mockResolvedValue(undefined);

      await useAuthStore.getState().verifyPhoneOtp("123456");

      expect(authService.verifyPhoneOtp).toHaveBeenCalledWith("123456");
      const state = useAuthStore.getState();
      expect(state.curr_phone).toBeUndefined();
      expect(state.isLoading).toBe(false);
    });

    it("clears loading and rethrows on a bad code, leaving curr_phone intact", async () => {
      useAuthStore.setState({ curr_phone: "+14155552671" });
      vi.mocked(authService.verifyPhoneOtp).mockRejectedValue(new Error("invalid_code"));

      await expect(useAuthStore.getState().verifyPhoneOtp("000000")).rejects.toThrow(
        "invalid_code",
      );

      const state = useAuthStore.getState();
      expect(state.curr_phone).toBe("+14155552671");
      expect(state.isLoading).toBe(false);
    });
  });

  describe("auth:expired", () => {
    it("clears the session when an auth:expired event fires", () => {
      subscribeAuthExpiry();
      useAuthStore.setState({ user: makeUser(), isAuthenticated: true });

      emitAuthExpired();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });
});
