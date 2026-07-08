"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuthStore } from "@/store/authStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UtensilsCrossed, Loader2, Phone } from "lucide-react";

const OTP_COOLDOWN = 30; // seconds

export default function VerifyPhone() {
  const router = useRouter();
  const { sendPhoneOtp, verifyPhoneOtp, isLoading, isAuthenticated, curr_phone } =
    useAuthStore();

  const [code, setCode]   = useState("");
  const [error, setError] = useState("");
  const [timer, setTimer] = useState(0);

  // Must be logged in for the authed OTP routes; the register journey auto-logs
  // in before reaching here. A direct, logged-out visit → back to login.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  // No phone captured this session (e.g. journey state lost) → back to register.
  useEffect(() => {
    if (!isLoading && isAuthenticated && !curr_phone) {
      router.replace("/register");
    }
  }, [isAuthenticated, isLoading, curr_phone, router]);

  // Send the phone OTP once on mount (guards against StrictMode double-invoke).
  const sentRef = useRef(false);
  useEffect(() => {
    if (sentRef.current) return;
    if (!isAuthenticated || !curr_phone) return;
    sentRef.current = true;
    sendPhoneOtp(curr_phone)
      .then(() => setTimer(OTP_COOLDOWN))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to send code."));
  }, [isAuthenticated, curr_phone, sendPhoneOtp]);

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
      await verifyPhoneOtp(code);
      router.replace("/");
    } catch (err: any) {
      setError(err.message || "Verification failed. Please check your code.");
      setCode("");
    }
  };

  const handleResend = async () => {
    if (timer > 0 || !curr_phone) return;
    setError("");
    try {
      await sendPhoneOtp(curr_phone);
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
            <CardTitle className="text-2xl text-center">Verify Your Phone</CardTitle>
            <CardDescription className="text-center">
              Enter the 6-digit code sent to your phone
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col items-center space-y-6 py-4">
          {/* Phone display */}
          <div className="flex items-center gap-2 w-full border rounded-lg py-2.5 px-4 bg-muted">
            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate">{curr_phone}</span>
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
              : "Verify Phone"}
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
        </CardContent>
      </Card>
    </div>
  );
}
