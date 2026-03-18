import { create } from "zustand";
import { toast } from "sonner";
import { persist } from "zustand/middleware";

interface User {
  _id: string;
  name: string;
  email: string;
  role?: string;
  loyaltyPoints?: number;
  loyaltyTier?: string;
  isVerified?: boolean;
  phone?: string;
  location?: string;
  bio?: string;
  birthday?: string;
  occupation?: string;
  avatar?: string;
  isAdmin?: boolean;
}

interface AuthState {
  user: User | null;
  curr_email?: string;
  isAuthenticated: boolean;
  isLoading: boolean;

  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  checkAuth: () => Promise<void>;
  fetchUserProfile: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  verifyEmail: (email: string, otp: string) => Promise<void>;
  resendOtp: (email: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, otp: string, newPassword: string) => Promise<void>;
}

const BASE = "http://localhost:8000/api";

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      curr_email: undefined,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setLoading: (loading) => set({ isLoading: loading }),

      checkAuth: async () => {
        set({ isLoading: true });
        try {
          const res = await fetch(`${BASE}/auth/check-auth`, {
            credentials: "include",
          });
          if (res.ok) {
            const data = await res.json();
            set({ user: data.user, isAuthenticated: true, isLoading: false });
          } else {
            set({ user: null, isAuthenticated: false, isLoading: false });
          }
        } catch {
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },

      fetchUserProfile: async () => {
        set({ isLoading: true });
        try {
          const res = await fetch(`${BASE}/users/profile`, {
            credentials: "include",
          });
          if (res.ok) {
            const data = await res.json();
            set({ user: data.user, isAuthenticated: true, isLoading: false });
          } else {
            set({ user: null, isAuthenticated: false, isLoading: false });
          }
        } catch (err: any) {
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },

      updateProfile: async (updates) => {
        try {
          const res = await fetch(`${BASE}/auth/update-profile`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(updates),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "Failed to update profile");
          set({ user: data.user });
          toast.success("Profile updated!");
        } catch (error: any) {
          toast.error(error.message || "Failed to update profile");
          throw error;
        }
      },

      register: async (name, email, password) => {
        set({ isLoading: true });
        try {
          // FIX: validate email format before sending
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            toast.error("Please enter a valid email address");
            set({ isLoading: false });
            return;
          }
          set({ curr_email: email });
          const res = await fetch(`${BASE}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password }),
          });
          const data = await res.json();
          if (!res.ok) {
            // FIX: show real server error
            toast.error(data.message || "Registration failed");
            set({ isLoading: false });
            throw new Error(data.message || "Registration failed");
          }
          toast.success("Account created! Please check your email for the verification code.");
          set({ isLoading: false });
        } catch (error: any) {
          set({ isLoading: false });
          throw error;
        }
      },

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const res = await fetch(`${BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
            credentials: "include",
          });
          const data = await res.json();
          if (!res.ok) {
            // FIX: show real server error
            toast.error(data.message || "Login failed");
            set({ isLoading: false });
            throw new Error(data.message || "Login failed");
          }
          set({ user: data.user, isAuthenticated: true, isLoading: false });
          toast.success(`Welcome back, ${data.user.name}!`);
        } catch (error: any) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          const res = await fetch(`${BASE}/auth/logout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          });
          const data = await res.json();
          // FIX: clear persisted storage on logout
          set({ user: null, isAuthenticated: false, isLoading: false, curr_email: undefined });
          // Clear zustand persisted storage
          if (typeof window !== "undefined") {
            localStorage.removeItem("auth-session-storage");
          }
          toast.success(data.message || "Logged out successfully");
        } catch {
          // FIX: still clear local state even if server call fails
          set({ user: null, isAuthenticated: false, isLoading: false, curr_email: undefined });
          if (typeof window !== "undefined") {
            localStorage.removeItem("auth-session-storage");
          }
          toast.success("Logged out");
        }
      },

      verifyEmail: async (email, otp) => {
        set({ isLoading: true });
        try {
          const res = await fetch(`${BASE}/auth/verify-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, otp }),
          });
          const data = await res.json();
          if (!res.ok) {
            toast.error(data.message || "Verification failed");
            // FIX: was setting isLoading:true on error — now false
            set({ isLoading: false });
            throw new Error(data.message || "Verification failed");
          }
          set({ isLoading: false, user: data.user, isAuthenticated: true });
          toast.success("Email verified successfully! Welcome aboard!");
        } catch (error: any) {
          set({ isLoading: false });
          throw error;
        }
      },

      resendOtp: async (email) => {
        set({ isLoading: true });
        try {
          // FIX: validate email before sending — prevents calling with placeholder
          if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            toast.error("Invalid email address");
            set({ isLoading: false });
            return;
          }
          const res = await fetch(`${BASE}/auth/resend-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });
          const data = await res.json();
          if (!res.ok) {
            toast.error(data.message || "Failed to resend OTP");
            set({ isLoading: false });
            throw new Error(data.message || "Failed to resend OTP");
          }
          toast.success("Verification code sent! Please check your email.");
          set({ isLoading: false });
        } catch (error: any) {
          set({ isLoading: false });
          throw error;
        }
      },

      forgotPassword: async (email) => {
        set({ isLoading: true });
        try {
          const res = await fetch(`${BASE}/auth/forgot-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });
          const data = await res.json();
          if (!res.ok) {
            toast.error(data.message || "Failed to send reset email");
            set({ isLoading: false });
            throw new Error(data.message || "Failed to send reset email");
          }
          set({ isLoading: false });
          toast.success("Password reset code sent! Check your email.");
        } catch (error: any) {
          set({ isLoading: false });
          throw error;
        }
      },

      resetPassword: async (email, otp, newPassword) => {
        set({ isLoading: true });
        try {
          const res = await fetch(`${BASE}/auth/reset-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, otp, newPassword }),
          });
          const data = await res.json();
          if (!res.ok) {
            // FIX: show real server error
            toast.error(data.message || "Password reset failed");
            set({ isLoading: false });
            throw new Error(data.message || "Password reset failed");
          }
          set({ isLoading: false });
          toast.success("Password reset successfully! You can now sign in.");
        } catch (error: any) {
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
      }),
    }
  )
);
