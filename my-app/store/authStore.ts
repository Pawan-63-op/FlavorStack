import { create } from "zustand";
import { toast } from "sonner";
import { persist } from "zustand/middleware";
import {
  type ProfileExtras,
  type User as ServerUser,
  mergeProfile,
} from "@/lib/api/adapters/user";
import { authService } from "@/lib/api/services/auth";
import { type RegisterInput } from "@/lib/api/adapters/register";
import { onAuthExpired } from "@/lib/api/client/authEvents";

/**
 * FE auth user view-model. Extends the server-backed {@link ServerUser}
 * (Phase 1 `userAdapter` shape: `_id,id,name,email,role,isVerified,avatar,
 * isAdmin,createdAt`) with the local-only {@link ProfileExtras} fields plus a
 * couple of legacy loyalty fields the server does not model yet. Kept wide so
 * existing consumers (header/profile/guard) compile untouched (Phase_1.md
 * §Key Decision 1 & 2).
 */
interface User extends ServerUser, ProfileExtras {
  loyaltyPoints?: number;
  loyaltyTier?: string;
}

interface AuthState {
  user: User | null;
  /** Email captured during the register journey (verify-email display). */
  curr_email?: string;
  /** Phone captured at register; needed for `phone-otp/send` (absent from `/users/me`). */
  curr_phone?: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Device-local profile fields server_2 doesn't model; persisted, never sent. */
  profileExtras: ProfileExtras;

  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  checkAuth: () => Promise<void>;
  fetchUserProfile: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  verifyEmail: (code: string) => Promise<void>;
  resendOtp: () => Promise<void>;
  sendPhoneOtp: (phone: string) => Promise<void>;
  verifyPhoneOtp: (code: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
}

/** Removes the persisted zustand slice (logout / auth:expired). */
function clearPersistedSession() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("auth-session-storage");
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      curr_email: undefined,
      curr_phone: undefined,
      profileExtras: {},

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setLoading: (loading) => set({ isLoading: loading }),

      checkAuth: async () => {
        set({ isLoading: true });
        try {
          const serverUser = await authService.me();
          set({
            user: mergeProfile(serverUser, get().profileExtras),
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },

      fetchUserProfile: async () => {
        try {
          const serverUser = await authService.me();
          set({
            user: mergeProfile(serverUser, get().profileExtras),
            isAuthenticated: true,
          });
        } catch {
        }
      },

      updateProfile: async (updates) => {
        try {
          const nextExtras: ProfileExtras = { ...get().profileExtras };
          if (updates.phone !== undefined) nextExtras.phone = updates.phone;
          if (updates.bio !== undefined) nextExtras.bio = updates.bio;
          if (updates.birthday !== undefined) nextExtras.birthday = updates.birthday;
          if (updates.occupation !== undefined) nextExtras.occupation = updates.occupation;
          if (updates.location !== undefined) nextExtras.location = updates.location;

          let serverUser: ServerUser | null = get().user;
          if (updates.name !== undefined || updates.avatar !== undefined) {
            serverUser = await authService.updateMe({
              name: updates.name,
              avatarUrl: updates.avatar,
            });
          }

          set({
            profileExtras: nextExtras,
            user: serverUser ? mergeProfile(serverUser, nextExtras) : get().user,
          });
          toast.success("Profile updated!");
        } catch (error: any) {
          toast.error(error.message || "Failed to update profile");
          throw error;
        }
      },

      register: async (input) => {
        set({ isLoading: true });
        try {
          await authService.register(input);
          const serverUser = await authService.login({
            email: input.email,
            password: input.password,
          });
          set({
            user: mergeProfile(serverUser, get().profileExtras),
            isAuthenticated: true,
            isLoading: false,
            curr_email: input.email,
            curr_phone: input.phone,
          });
          toast.success("Account created! Let's verify your email.");
        } catch (error: any) {
          toast.error(error?.message || "Registration failed");
          set({ isLoading: false });
          throw error;
        }
      },

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const serverUser = await authService.login({ email, password });
          set({
            user: mergeProfile(serverUser, get().profileExtras),
            isAuthenticated: true,
            isLoading: false,
          });
          toast.success(`Welcome back, ${serverUser.name}!`);
        } catch (error: any) {
          toast.error(error?.message || "Login failed");
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          await authService.logout();
        } catch {
        } finally {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            curr_email: undefined,
            curr_phone: undefined,
          });
          clearPersistedSession();
        }
        toast.success("Logged out successfully");
      },

      verifyEmail: async (code) => {
        set({ isLoading: true });
        try {
          await authService.verifyEmailOtp(code);
          const serverUser = await authService.me();
          set({
            user: mergeProfile(serverUser, get().profileExtras),
            isAuthenticated: true,
            isLoading: false,
          });
          toast.success("Email verified!");
        } catch (error: any) {
          toast.error(error?.message || "Verification failed");
          set({ isLoading: false });
          throw error;
        }
      },

      resendOtp: async () => {
        try {
          await authService.sendEmailOtp();
          toast.success("Verification code sent! Please check your email.");
        } catch (error: any) {
          toast.error(error?.message || "Failed to send code");
          throw error;
        }
      },

      sendPhoneOtp: async (phone) => {
        try {
          await authService.sendPhoneOtp(phone);
          toast.success("Verification code sent! Please check your phone.");
        } catch (error: any) {
          toast.error(error?.message || "Failed to send code");
          throw error;
        }
      },

      verifyPhoneOtp: async (code) => {
        set({ isLoading: true });
        try {
          await authService.verifyPhoneOtp(code);
          set({ curr_phone: undefined, isLoading: false });
          toast.success("Phone verified!");
        } catch (error: any) {
          toast.error(error?.message || "Verification failed");
          set({ isLoading: false });
          throw error;
        }
      },

      forgotPassword: async (email) => {
        set({ isLoading: true });
        try {
          await authService.forgotPassword(email);
          set({ isLoading: false });
          toast.success("If that email exists, a password reset code has been sent.");
        } catch (error: any) {
          toast.error(error?.message || "Failed to send reset email");
          set({ isLoading: false });
          throw error;
        }
      },

      resetPassword: async (email, code, newPassword) => {
        set({ isLoading: true });
        try {
          await authService.resetPassword({ email, code, newPassword });
          set({ isLoading: false });
          toast.success("Password reset successfully! You can now sign in.");
        } catch (error: any) {
          toast.error(error?.message || "Password reset failed");
          set({ isLoading: false });
          throw error;
        }
      },
    }),
    {
      name: "auth-session-storage",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        curr_email: state.curr_email,
        curr_phone: state.curr_phone,
        profileExtras: state.profileExtras,
      }),
    }
  )
);

let authExpirySubscribed = false;

/**
 * Subscribe (once) to the client's `auth:expired` signal and clear the session
 * when it fires — mirrors {@link logout} without the network call. Bootstrap
 * (ClientInit, Phase 1.3) calls this; idempotent so repeat calls are no-ops.
 */
export function subscribeAuthExpiry(): void {
  if (authExpirySubscribed) return;
  authExpirySubscribed = true;
  onAuthExpired(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      curr_email: undefined,
      curr_phone: undefined,
    });
    clearPersistedSession();
  });
}

subscribeAuthExpiry();
