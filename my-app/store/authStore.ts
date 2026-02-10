
import { create } from "zustand";
import { toast } from "sonner";
// import axios from "axios";
// import Iuser from "@/types/allType";
import { persist,type StateStorage } from 'zustand/middleware'
// import type {IUser}  from "@/types/allType";

interface User {
  // id: string;
  // name: string;
  // email: string;
  // isAdmin: boolean;
  // isVerified: boolean;
  // loyaltyPoints?: number;
  // loyaltyTier?: string;
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
  occupation: string;
  avatar?:string;
  isAdmin?:boolean
}

interface AuthState {
  resendOtp: (email: string) => Promise<void>;

  user: User | null;
  curr_email?:string;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  verifyEmail: (email: string, otp: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, otp: string, newPassword: string) => Promise<void>;
  checkAuth: () => Promise<void>;
  fetchUserProfile : () => Promise<void>;
 updateProfile:  (updates: Partial<User>) => Promise<void>;
}


export const useAuthStore = create<AuthState>()(persist((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setLoading: (loading) => set({ isLoading: loading }),

  checkAuth: async () => {
    try {
     

      set({ isLoading: true });
      // const response = await fetch("http://localhost:8000/api/auth/check-auth");
       const response = await fetch("http://localhost:8000/api/auth/check-auth", {
      credentials: "include", // send cookies automatically
    });

            //const response = await axios.get(`${API_END_POINT}/check-auth`);
            //  const response = await axios.get(`${API_END_POINT}/check-auth`);
          //  console.log(response.data);
          
      if (response.ok) {
        const data = await response.json();
        set({ user: data.user, isAuthenticated: true, isLoading: false });
      } else {
     
        set({ user: null, isAuthenticated: false ,isLoading: false });
      }
      return;
    } catch (error) {
      console.error("Auth check failed:", error);
    
      set({ user: null, isAuthenticated: false , isLoading:false });
      return;
    } finally {
      set({ isLoading: false });
      return;
    }
  },
  fetchUserProfile: async () => {
  set({ isLoading: true });
  try {
      const response = await fetch("http://localhost:8000/api/users/profile", {
      credentials: "include",
      });
     if(response.ok) {
        const data = await response.json();
        console.log(data.user);
        set({ user: data.user, isAuthenticated: true, isLoading: false });
      } else {
     
        set({ user: null, isAuthenticated: false ,isLoading: false });
      }
      return;
  } catch (err: any) {
    console.error(err);
    set({ user: null, isAuthenticated: false , isLoading:false });
    return;
  }
},
   updateProfile: async (updates: Partial<User>) => {
        try {
          const response = await fetch('http://localhost:8000/api/auth/update-profile', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(updates),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || 'Failed to update profile');
          }

          set({ user: data.user });
          // console.log();
        } catch (error: any) {
          throw error;
        }
      },
resendOtp: async (email: string) => {
  try {
     set({isLoading: true });
    const response = await fetch("http://localhost:8000/api/auth/resend-otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok) {
      toast.error(data.message || "Failed to resend OTP");
        set({isLoading: false });
      throw new Error(data.message || "Failed to resend OTP");
    }else{
      toast.success("OTP resent successfully! Please check your email.");
      set({isLoading: false });
    }
  } catch (error: any) {
    console.error("Resend OTP error:", error);
    toast.error(error.message || "Something went wrong while resending OTP");
      set({isLoading: false });
    throw error;
  }
},

  register: async (name: string, email: string, password: string) => {
    try {
        set({isLoading: true });
      set({ curr_email: email });
      const response = await fetch("http://localhost:8000/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error( "Registration failed");
        set({isLoading: false });
        throw new Error( "Registration failed");
      }else{

        toast.success("Registration successful! Please check your email to verify your account.");
        set({isLoading: false });
      }

      return data;
    } catch (error: any) {
      set({isLoading: false });
      throw error;
    }
  },

  login: async (email: string, password: string) => {
   
  
    try {
       set({isLoading: true });
      const response = await fetch("http://localhost:8000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
        credentials: "include", 
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error( "Login failed");
           set({isLoading: false });
        throw new Error( "Login failed");
      }
// console.log(data.op);
   
//        localStorage.setItem("token", data.op);
      set({ user: data.user, isAuthenticated: true, isLoading:false });
      toast.success(`Welcome back, ${data.user.name}!`);
    } catch (error1: any) {
      toast.error("error is there");
       set({isLoading: false });
      throw error1;
    }
  },

  logout: async () => {
        try {
            set({ isLoading: true });
            const response = await fetch("http://localhost:8000/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
       credentials: "include",
       
      });
                const data = await response.json();
                console.log(data.message);
                if (response.ok) {
                toast.success(data.message);
                set({ isLoading: false, user: null, isAuthenticated: false })
            }
        } catch (error:any) {
            toast.error("error is there ");
            set({ isLoading: false });
        }
    },

  verifyEmail: async (email: string, otp: string) => {
    try {
      set({isLoading: true });
      const response = await fetch("http://localhost:8000/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || "Verification failed");
        set({isLoading:true});
        throw new Error(data.message || "Verification failed");
      }else{
        set({isLoading:false,user: data.user, isAuthenticated: true });

      }

      // localStorage.setItem("token", data.token);
      toast.success("Email verified successfully!");
    } catch (error: any) {
      throw error;
    }
  },

  forgotPassword: async (email: string) => {
    try {
      set({isLoading:true});
      const response = await fetch("http://localhost:8000/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || "Failed to send reset email");
         set({isLoading: false });
        throw new Error(data.message || "Failed to send reset email");
      }
 set({isLoading: false });
      toast.success("Password reset OTP sent to your email!");
    } catch (error: any) {
       set({isLoading: false });
      throw error;
    }
  },

  resetPassword: async (email: string, otp: string, newPassword: string) => {
    try {
        set({isLoading: true });
      const response = await fetch("http://localhost:8000/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, otp, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || "Password reset failed");
         set({isLoading: false });
        throw new Error(data.message || "Password reset failed");
      }
 set({isLoading: false });
      toast.success("Password reset successfully! You can now login.");
    } catch (error: any) {
       set({isLoading: false });
      throw error;
    }
  },
}),
{
      name: "auth-session-storage", // Key in storage
      // //getStorage: () => sessionStorage, // 🔥 Use sessionStorage instead of localStorage
     
      // partialize: (state) => ({
      //   user: state.user,
      //   isAuthenticated: state.isAuthenticated,
      // }),
    }
  )
);