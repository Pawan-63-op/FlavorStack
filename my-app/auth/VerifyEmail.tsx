"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuthStore } from "@/store/authStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UtensilsCrossed, Loader2, Mail } from "lucide-react";

const OTP_COOLDOWN = 30; // seconds

export default function VerifyEmail() {
  const router                          = useRouter();
  const searchParams                    = useSearchParams();
  const { verifyEmail, resendOtp, isLoading, isAuthenticated, user } = useAuthStore();

  // Email is for display only now — the OTP endpoints are authed (server uses
  // the session). Prefer the authed user's email; fall back to the journey hints.
  const urlEmail                        = searchParams.get("email") || "";
  const storeEmail                      = useAuthStore((s) => s.curr_email);
  const email                           = user?.email || urlEmail || storeEmail || "";

  const [code, setCode]                 = useState("");
  const [error, setError]               = useState("");
  const [timer, setTimer]               = useState(0);

  // Must be logged in for the authed OTP routes; the register journey auto-logs
  // in before reaching here. A direct, logged-out visit → back to login.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  // Email already verified → skip straight to the phone step.
  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.isVerified) {
      router.replace("/verify-phone");
    }
  }, [isAuthenticated, isLoading, user, router]);

  // Send the email OTP once on mount (guards against StrictMode double-invoke).
  const sentRef = useRef(false);
  useEffect(() => {
    if (sentRef.current) return;
    if (!isAuthenticated || user?.isVerified) return;
    sentRef.current = true;
    resendOtp()
      .then(() => setTimer(OTP_COOLDOWN))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to send code."));
  }, [isAuthenticated, user, resendOtp]);

  // Countdown timer
  useEffect(() => {
    if (timer <= 0) return;
    const id = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  const handleVerify = async () => {
    if (code.length < 6) return;
    setError("");
    try {
      await verifyEmail(code);
      router.replace("/verify-phone");
    } catch (err: any) {
      setError(err.message || "Verification failed. Please check your code.");
      setCode("");
    }
  };

  const handleResend = async () => {
    if (timer > 0) return;
    setError("");
    try {
      await resendOtp();
      setTimer(OTP_COOLDOWN);
    } catch (err: any) {
      setError(err.message || "Failed to resend code.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-accent/30 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <div className="flex items-center gap-3">
              <UtensilsCrossed className="h-10 w-10 text-primary" />
              <h2 className="text-2xl font-semibold">Delicious Bites</h2>
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl text-center">Verify Your Email</CardTitle>
            <CardDescription className="text-center">
              Enter the 6-digit code sent to your email
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col items-center space-y-6 py-4">
          {/* Email display */}
          <div className="flex items-center gap-2 w-full border rounded-lg py-2.5 px-4 bg-muted">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate">{email}</span>
          </div>

          {error && (
            <Alert variant="destructive" className="w-full">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* OTP input */}
          <div className="flex flex-col items-center gap-2">
            <InputOTP value={code} maxLength={6} onChange={setCode}>
              <InputOTPGroup>
                {[...Array(6)].map((_, i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <p className="text-xs text-muted-foreground">Enter the 6-digit code</p>
          </div>

          {/* Verify button */}
          <Button className="w-full" onClick={handleVerify}
            disabled={isLoading || code.length < 6}>
            {isLoading
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</>
              : "Verify Email"}
          </Button>

          {/* Resend with visible countdown timer */}
          <div className="text-center text-sm text-muted-foreground">
            Didn't receive the code?{" "}
            {timer > 0 ? (
              <span className="text-muted-foreground">
                Resend in <span className="font-medium text-foreground">{timer}s</span>
              </span>
            ) : (
              <button type="button" onClick={handleResend}
                disabled={isLoading}
                className="text-primary font-medium hover:underline disabled:opacity-50">
                Resend code
              </button>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Wrong email?{" "}
            <button onClick={() => router.push("/register")}
              className="text-primary hover:underline">
              Go back
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
