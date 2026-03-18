"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthStore } from "@/store/authStore";
import { resetPasswordSchema, type ResetPasswordFormData } from "@/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { UtensilsCrossed, Loader2, Eye, EyeOff, ArrowLeft, CheckCircle } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export function ResetPassword() {
  const [error, setError]               = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [isSuccess, setIsSuccess]       = useState(false);
  const router                          = useRouter();
  const searchParams                    = useSearchParams();
  const resetPassword                   = useAuthStore((s) => s.resetPassword);
  const isAuthenticated                 = useAuthStore((s) => s.isAuthenticated);
  const isLoading                       = useAuthStore((s) => s.isLoading);
  const user                            = useAuthStore((s) => s.user);

  const email = searchParams.get("email") || "";

  // FIX: redirect guard — logged in users don't need this
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, user]);

  // FIX: no email in URL → go back to forgot-password
  useEffect(() => {
    if (!email) {
      router.replace("/forgot-password");
    }
  }, [email]);

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { otp: "", newPassword: "", confirmPassword: "" },
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    setError("");
    try {
      await resetPassword(email, data.otp, data.newPassword);
      // FIX: show success state with feedback before redirecting
      setIsSuccess(true);
      setTimeout(() => router.replace("/login"), 2000);
    } catch (err: any) {
      // FIX: show real error message
      setError(err.message || "Failed to reset password. Please try again.");
    }
  };

  // Success state
  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-accent/30 p-4">
        <Card className="w-full max-w-md shadow-lg text-center">
          <CardContent className="pt-12 pb-12 space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-semibold">Password Reset!</h2>
            <p className="text-muted-foreground text-sm">
              Your password has been updated. Redirecting to sign in...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
            <CardTitle className="text-2xl text-center">Reset Password</CardTitle>
            <CardDescription className="text-center">
              Enter the code sent to{" "}
              <span className="font-medium text-foreground">{email}</span>
            </CardDescription>
          </div>
        </CardHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-5">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <FormField control={form.control} name="otp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block text-center">Verification Code</FormLabel>
                    <FormControl>
                      <div className="flex justify-center">
                        <InputOTP maxLength={6}
                          disabled={form.formState.isSubmitting} {...field}>
                          <InputOTPGroup>
                            {[0,1,2,3,4,5].map((i) => (
                              <InputOTPSlot key={i} index={i} />
                            ))}
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                    </FormControl>
                    <FormMessage className="text-center" />
                  </FormItem>
                )}
              />

              <FormField control={form.control} name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          disabled={form.formState.isSubmitting} {...field} />
                        <button type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowPassword((v) => !v)}>
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField control={form.control} name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type={showConfirm ? "text" : "password"}
                          placeholder="••••••••"
                          disabled={form.formState.isSubmitting} {...field} />
                        <button type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowConfirm((v) => !v)}>
                          {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full"
                disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resetting...</>
                  : "Reset Password"}
              </Button>

              <Link href="/forgot-password"
                className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" /> Use a different email
              </Link>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
