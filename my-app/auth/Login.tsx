"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthStore } from "@/store/authStore";
import { loginSchema, type LoginFormData } from "@/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { UtensilsCrossed, Loader2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export function Login() {
  const [error, setError]           = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const router                      = useRouter();
  const searchParams                = useSearchParams();
  const login                       = useAuthStore((s) => s.login);
  const isAuthenticated             = useAuthStore((s) => s.isAuthenticated);
  const isLoading                   = useAuthStore((s) => s.isLoading);
  const user                        = useAuthStore((s) => s.user);

  // FIX: redirect guard — already logged in → go home
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      const from = searchParams.get("from") || "/";
      router.replace(from);
    }
  }, [isAuthenticated, isLoading, user]);

  const from = searchParams.get("from") || "/";

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginFormData) => {
    setError("");
    try {
      await login(data.email, data.password);
      // FIX: correct route — was "/Home"
      router.push(from);
    } catch (err: any) {
      // FIX: show real error message instead of "err"
      setError(err.message || "Login failed. Please check your credentials.");
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
            <CardTitle className="text-2xl text-center">Welcome Back</CardTitle>
            <CardDescription className="text-center">
              Sign in to your account to continue
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
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="name@example.com"
                        disabled={form.formState.isSubmitting} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField control={form.control} name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Password</FormLabel>
                      <Link href="/forgot-password"
                        className="text-sm text-primary hover:underline">
                        Forgot password?
                      </Link>
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          disabled={form.formState.isSubmitting}
                          {...field}
                        />
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
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full"
                disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</>
                  : "Sign In"}
              </Button>

              <p className="text-sm text-muted-foreground text-center">
                Don't have an account?{" "}
                <Link href="/register" className="text-primary hover:underline">
                  Sign up
                </Link>
              </p>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
