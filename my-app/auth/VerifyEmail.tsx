// "use client";
// import React, { useState } from "react";
// import axios from "axios";
// import { toast } from "sonner";
// import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";

// export default function VerifyEmail() {
//   const [otp, setOtp] = useState("");
//   const [email, setEmail] = useState("");
//   const [loading, setLoading] = useState(false);

//   async function verifyEmail() {
//     try {
//       setLoading(true);
//       const { data } = await axios.post("/api/v1/auth/verify-email", { email, otp });
//       toast.success("Email verified successfully!");
//       return data;
//     } catch (err: any) {
//       toast.error(err.response?.data?.message || "Verification failed");
//     } finally {
//       setLoading(false);
//     }
//   }
  

//   return (
//     <div className="flex flex-col gap-4 items-center">
//       <input
//         type="email"
//         placeholder="Enter your email"
//         className="border px-3 py-2 rounded-md w-64"
//         value={email}
//         onChange={(e) => setEmail(e.target.value)}
//       />

//       <InputOTP value={otp}  maxLength={6} onChange={(value) => setOtp(value)}>
//         <InputOTPGroup>
//           {[...Array(6)].map((_, i) => (
//             <InputOTPSlot key={i} index={i} />
//           ))}
//         </InputOTPGroup>
//       </InputOTP>

//       <button
//         onClick={verifyEmail}
//         disabled={loading}
//         className="bg-blue-600 text-white px-4 py-2 rounded-md"
//       >
//         {loading ? "Verifying..." : "Verify Email"}
//       </button>
//     </div>
//   );
// }
"use client";

import React, { useState } from "react";
// import axios from "axios";
// import { toast } from "sonner";

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
// import { useNavigate } from "react-router-dom";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { IntegerType } from "mongodb";
// import type { ZodEmail } from "zod";
export default function VerifyEmail( ) {
  const [timer, setTimer] = useState(0);
  
  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer(timer - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);
  // 🧠 Keep your original state and logic
  const [otp, setOtp] = useState("");
const email = useAuthStore((state) => state.curr_email || "name@gmail.com");
// const email = useState("name@gmail.com");
// const verifyEmail= useAuthStore((state) => state.verifyEmail);
const { verifyEmail,resendOtp}=useAuthStore();
  const [loading, setLoading] = useState(false);
  // const navigate = useNavigate();
  const router = useRouter();
  const submitHandler = async () => {
    
    const verificationCode = otp
    try {
      await verifyEmail(email,verificationCode);
      router.push("/");
    } catch (error) {console.log(error);
    }
  
  }
  const handleResend = async () => {
  try {
    await resendOtp("pavan@example.com");
    setTimer(30);
  } catch (err) {
    console.error(err);
  }
};
  // async function verifyEmail() {
  //   try {
  //     setLoading(true);
  //     const { data } = await axios.post("/api/v1/auth/verify-email", { email, otp });
  //     toast.success("Email verified successfully!");
  //     navigate("/");
  //     return data;
  //   } catch (err: any) {
  //     toast.error(err.response?.data?.message || "Verification failed");
  //   } finally {
  //     setLoading(false);
  //   }
  // }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted px-4">
      <Card className="w-full max-w-md shadow-lg border border-border/60 bg-card">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Verify Your Email
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Enter the 6-digit code we sent to your email address.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col items-center space-y-6 py-6">
          {/* ✅ Non-editable email display */}
          <div className="w-full text-center border rounded-lg py-2 px-4 bg-muted text-foreground/90 font-medium">
            {email}
          </div>

          {/* OTP Input */}
          <div className="flex justify-center">
            <InputOTP
              value={otp}
              maxLength={6}
              onChange={(value:any) => setOtp(value)}
            >
              <InputOTPGroup>
                {[...Array(6)].map((_, i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          {/* Verify Button */}
          <Button
            className="w-full mt-4 font-medium text-base"
            onClick={submitHandler}
            disabled={loading || otp.length < 6}
          >
            {loading ? "Verifying..." : "Verify Email"}
          </Button>

          {/* Optional: Resend link */}
          <p className="text-sm text-muted-foreground mt-3 text-center">
            Didn’t receive the code?{" "}
            <button
              type="button"
              className="text-primary font-medium hover:underline"
              onClick={async () => {
  try {
    await resendOtp(email);  
    // toast.success("OTP sent successfully"); // show success toast
    setTimer(30);        // call the async function
  } catch (err) {
    // toast.error("Failed to send OTP");     // show error if request fails
    // console.error(err);
  }
}}

            >
              Resend OTP
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
// const export 

// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { useAuthStore } from "@/store/authStore";
// import { Loader2 } from "lucide-react";
// import {  useRef, useState } from "react";
// import type { FormEvent } from "react";
// import { useNavigate } from "react-router-dom";
// import { useCartStore } from "@/store/cartStore";
// const VerifyEmail = () => {
//   const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
//   const inputRef = useRef<any>([]);
//  const isloading = useAuthStore((state) => state.isLoading);
//  const verifyEmail= useAuthStore((state) => state.verifyEmail);
//   const navigate = useNavigate();
//   const handleChange = (index: number, value: string) => {
//     if (/^[a-zA-Z0-9]$/.test(value) || value === "") {
//       const newOtp = [...otp];
//       newOtp[index] = value;
//       setOtp(newOtp);
//     }
//     // Move to the next input field id a digit is entered
//     if (value !== "" && index < 5) {
//       inputRef.current[index + 1].focus();
//     }
//   };

//   const handleKeyDown = (
//     index: number,
//     e: React.KeyboardEvent<HTMLInputElement>
//   ) => {
//     if (e.key === "Backspace" && !otp[index] && index > 0) {
//       inputRef.current[index - 1].focus();
//     }
//   };
//   const submitHandler = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     const verificationCode = otp.join("");
//     try {
//       await verifyEmail(verificationCode);
//       navigate("/");
//     } catch (error) {console.log(error);
//     }
//   };

//   return (
//     <div className="flex items-center justify-center h-screen w-full">
//       <div className="p-8 rounded-md w-full max-w-md flex flex-col gap-10 border border-gray-200">
//         <div className="text-center">
//           <h1 className="font-extrabold text-2xl">Verify your email</h1>
//           <p className="text-sm text-gray-600">
//             Enter the 6 digit code sent to your email address
//           </p>
//         </div>
//         <form onSubmit={submitHandler}>
//           <div className="flex justify-between">
//             {otp.map((letter: string, idx: number) => (
//               <Input
//                 key={idx}
//                 ref={(element) => (inputRef.current[idx] = element)}
//                 type="text"
//                 maxLength={1}
//                 value={letter}
//                 onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
//                   handleChange(idx, e.target.value)
//                 }
//                 onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) =>
//                   handleKeyDown(idx, e)
//                 }
//                 className="md:w-12 md:h-12 w-8 h-8 text-center text-sm md:text-2xl font-normal md:font-bold rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
//               />
//             ))}
//           </div>
//           {isloading ? (
//             <Button
//               disabled
//               className="bg-[#d19254] hover:bg-[#db8128] mt-6 w-full"
//             >
//               <Loader2 className="mr-2 w-4 h-4 animate-spin" />
//               Please wait
//             </Button>
//           ) : (
//             <Button className="bg-[#d19254] hover:bg-[#db8128] mt-6 w-full">
//               Verify
//             </Button>
//           )}
//         </form>
//       </div>
//     </div>
//   );
// };

// export default VerifyEmail;

