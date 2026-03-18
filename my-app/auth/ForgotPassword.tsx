"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthStore } from "@/store/authStore";
import { forgotPasswordSchema, type ForgotPasswordFormData } from "@/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { UtensilsCrossed, Loader2, ArrowLeft, MailCheck } from "lucide-react";

export function ForgotPassword() {
  const [error, setError]       = useState("");
  const [sentTo, setSentTo]     = useState(""); // FIX: success state
  const router                  = useRouter();
  const forgotPassword          = useAuthStore((s) => s.forgotPassword);
  const isAuthenticated         = useAuthStore((s) => s.isAuthenticated);
  const isLoading               = useAuthStore((s) => s.isLoading);
  const user                    = useAuthStore((s) => s.user);

  // FIX: redirect guard — logged in users don't need this page
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, user]);

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setError("");
    try {
      await forgotPassword(data.email);
      // FIX: show success state instead of staying on blank form
      setSentTo(data.email);
      router.push(`/reset-password?email=${encodeURIComponent(data.email)}`);
    } catch (err: any) {
      setError(err.message || "Failed to send reset email. Please try again.");
    }
  };

  // Success state
  if (sentTo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-accent/30 p-4">
        <Card className="w-full max-w-md shadow-lg text-center">
          <CardContent className="pt-12 pb-12 space-y-4">
            <MailCheck className="h-16 w-16 text-primary mx-auto" />
            <h2 className="text-2xl font-semibold">Check Your Email</h2>
            <p className="text-muted-foreground text-sm">
              We sent a password reset code to
            </p>
            <p className="font-medium">{sentTo}</p>
            <Button className="w-full mt-4"
              onClick={() => router.push(`/reset-password?email=${encodeURIComponent(sentTo)}`)}>
              Enter Reset Code
            </Button>
            <button onClick={() => setSentTo("")}
              className="text-sm text-muted-foreground hover:text-foreground">
              Use a different email
            </button>
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
            <CardTitle className="text-2xl text-center">Forgot Password?</CardTitle>
            <CardDescription className="text-center">
              Enter your email and we'll send you a code to reset your password
            </CardDescription>
          </div>
        </CardHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <FormField control={form.control} name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="name@example.com"
                        disabled={form.formState.isSubmitting} {...field} />
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
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending code...</>
                  : "Send Reset Code"}
              </Button>

              <Link href="/login"
                className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </Link>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
