"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthStore } from "@/store/authStore";
import { registerWithRoleSchema, type RegisterWithRoleFormData } from "@/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { UtensilsCrossed, Loader2, Eye, EyeOff, User, Bike } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VehicleInput } from "@/lib/api/adapters/register";

export function Register() {
  const [error, setError]               = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const router                          = useRouter();
  const registerUser                    = useAuthStore((s) => s.register);
  const isAuthenticated                 = useAuthStore((s) => s.isAuthenticated);
  const isLoading                       = useAuthStore((s) => s.isLoading);
  const user                            = useAuthStore((s) => s.user);

  // Already-verified user lands here → go home. A *just-registered* (auto-
  // logged-in but unverified) user is NOT redirected by this guard; onSubmit
  // drives them to /verify-email instead.
  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.isVerified) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, user]);

  const form = useForm<RegisterWithRoleFormData>({
    resolver: zodResolver(registerWithRoleSchema),
    defaultValues: {
      role: "CUSTOMER",
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      vehicle: {
        type: "BIKE",
        brand: "",
        model: "",
        licensePlate: "",
        rcDocumentUrl: "https://example.com/rc.pdf",
        insuranceUrl: "https://example.com/insurance.pdf",
      },
    },
  });

  const role = form.watch("role");
  const isDriver = role === "DRIVER";

  const onSubmit = async (data: RegisterWithRoleFormData) => {
    setError("");
    try {
      // Store registers then auto-logs-in; session is live on success.
      await registerUser({
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: data.password,
        role: data.role,
        // superRefine guarantees all vehicle fields are present when DRIVER.
        vehicle: data.role === "DRIVER" ? (data.vehicle as VehicleInput) : undefined,
      });
      // Both roles auto-login unverified; the driver route-group guard requires a
      // verified email, so everyone is routed through /verify-email first.
      router.push("/verify-email");
    } catch (err: any) {
      // FIX: show real error
      setError(err.message || "Registration failed. Please try again.");
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
            <CardTitle className="text-2xl text-center">Create Account</CardTitle>
            <CardDescription className="text-center">
              {isDriver
                ? "Sign up as a delivery partner"
                : "Sign up to start ordering delicious food"}
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

              {/* Phase 1 (G4): role toggle — Customer vs Driver self-registration. */}
              <FormField control={form.control} name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>I want to join as</FormLabel>
                    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Account type">
                      <button type="button" role="radio" aria-checked={field.value === "CUSTOMER"}
                        onClick={() => field.onChange("CUSTOMER")}
                        disabled={form.formState.isSubmitting}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-lg border-2 p-3 text-sm transition-colors",
                          field.value === "CUSTOMER"
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-muted text-muted-foreground hover:border-primary/40",
                        )}>
                        <User className="h-5 w-5" />
                        Customer
                      </button>
                      <button type="button" role="radio" aria-checked={field.value === "DRIVER"}
                        onClick={() => field.onChange("DRIVER")}
                        disabled={form.formState.isSubmitting}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-lg border-2 p-3 text-sm transition-colors",
                          field.value === "DRIVER"
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-muted text-muted-foreground hover:border-primary/40",
                        )}>
                        <Bike className="h-5 w-5" />
                        Driver
                      </button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField control={form.control} name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input type="text" placeholder="John Doe"
                        disabled={form.formState.isSubmitting} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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

              <FormField control={form.control} name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="+14155552671"
                        disabled={form.formState.isSubmitting} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField control={form.control} name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
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
                    <p className="text-xs text-muted-foreground">
                      At least 8 characters, with an uppercase letter, a number, and a special character.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField control={form.control} name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
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

              {/* Phase 1 (G4): vehicle/KYC details — only when registering as a driver. */}
              {isDriver && (
                <div className="space-y-4 rounded-lg border border-dashed border-primary/40 p-4">
                  <p className="text-sm font-medium text-foreground">Vehicle details</p>

                  <FormField control={form.control} name="vehicle.type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vehicle Type</FormLabel>
                        <FormControl>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            disabled={form.formState.isSubmitting}
                            {...field}
                            value={field.value ?? "BIKE"}>
                            <option value="BIKE">Bike</option>
                            <option value="SCOOTER">Scooter</option>
                            <option value="CAR">Car</option>
                            <option value="BICYCLE">Bicycle</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="vehicle.brand"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Brand</FormLabel>
                          <FormControl>
                            <Input type="text" placeholder="Honda"
                              disabled={form.formState.isSubmitting} {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField control={form.control} name="vehicle.model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Model</FormLabel>
                          <FormControl>
                            <Input type="text" placeholder="Activa"
                              disabled={form.formState.isSubmitting} {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField control={form.control} name="vehicle.licensePlate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>License Plate</FormLabel>
                        <FormControl>
                          <Input type="text" placeholder="KA01AB1234"
                            disabled={form.formState.isSubmitting} {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField control={form.control} name="vehicle.rcDocumentUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>RC Document URL</FormLabel>
                        <FormControl>
                          <Input type="url" placeholder="https://…/rc.pdf"
                            disabled={form.formState.isSubmitting} {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField control={form.control} name="vehicle.insuranceUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Insurance URL</FormLabel>
                        <FormControl>
                          <Input type="url" placeholder="https://…/insurance.pdf"
                            disabled={form.formState.isSubmitting} {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full"
                disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account...</>
                  : isDriver ? "Create Driver Account" : "Create Account"}
              </Button>

              <p className="text-sm text-muted-foreground text-center">
                Already have an account?{" "}
                <Link href="/login" className="text-primary hover:underline">Sign in</Link>
              </p>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
