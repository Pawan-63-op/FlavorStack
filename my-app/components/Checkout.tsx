"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Banknote,
  CreditCard,
  Home,
  Briefcase,
  Loader2,
  LogIn,
  MapPin,
  MoreHorizontal,
  ShoppingBag,
  Smartphone,
  Star,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Badge } from "./ui/badge";
import { useCart } from "@/lib/api/hooks/useCart";
import { usePlaceOrder, usePreviewCheckout } from "@/lib/api/hooks/useCheckout";
import { PAYMENT_METHODS, type FeeType, type PaymentMethod } from "@/lib/api/adapters/checkout";
import { ApiError } from "@/lib/api/errors/ApiError";
import { toDeliveryAddress } from "@/lib/address/toDeliveryAddress";
import { useAddressStore } from "@/store/addressStore";
import { useHydrateAddresses } from "@/lib/api/hooks/useHydrateAddresses";
import { useAuthStore } from "@/store/authStore";

const LABEL_ICON: Record<string, React.ReactNode> = {
  Home: <Home className="h-3.5 w-3.5" />,
  Work: <Briefcase className="h-3.5 w-3.5" />,
};

function labelIcon(label: string) {
  return LABEL_ICON[label] ?? <MoreHorizontal className="h-3.5 w-3.5" />;
}

const PAYMENT_ICON: Record<PaymentMethod, React.ReactNode> = {
  CARD: <CreditCard className="h-5 w-5 text-muted-foreground" />,
  UPI: <Smartphone className="h-5 w-5 text-muted-foreground" />,
  WALLET: <Wallet className="h-5 w-5 text-muted-foreground" />,
  COD: <Banknote className="h-5 w-5 text-muted-foreground" />,
};

const FEE_LABEL: Record<FeeType, string> = {
  PLATFORM: "Platform fee",
  PACKAGING: "Packaging",
  DELIVERY: "Delivery fee",
};

/** Shared shell so empty / signed-out / loading states stay visually consistent. */
function CheckoutShell({ children }: { children: React.ReactNode }) {
  return <div className="w-full max-w-2xl mx-auto">{children}</div>;
}

export function Checkout() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const cartQuery = useCart();
  const cart = cartQuery.data;
  const items = cart?.items ?? [];

  const addresses = useAddressStore((s) => s.addresses);
  useHydrateAddresses();
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    () => addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? null,
  );
  // Addresses hydrate from the server after mount; keep a valid selection
  // (prefer the default) once they arrive or if the current pick disappears.
  useEffect(() => {
    if (selectedAddressId && addresses.some((a) => a.id === selectedAddressId)) return;
    setSelectedAddressId(addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? null);
  }, [addresses, selectedAddressId]);
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CARD");

  // One idempotency key per checkout session: a double-submit (button mash or a
  // retried network call) replays the same logical order instead of duplicating.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const deliveryPoint = selectedAddress
    ? { lat: selectedAddress.lat, lng: selectedAddress.lng }
    : null;
  const previewQuery = usePreviewCheckout(deliveryPoint);
  const preview = previewQuery.data;

  const placeOrder = usePlaceOrder();

  const belowMinOrder =
    !!preview &&
    preview.minOrder.amount != null &&
    preview.minOrder.amount > 0 &&
    (preview.pricing.subtotal.amount ?? 0) < preview.minOrder.amount;
  const notServiceable = !!preview && !preview.serviceable;

  const canPlaceOrder =
    !!selectedAddress &&
    !!preview &&
    !notServiceable &&
    !belowMinOrder &&
    items.length > 0 &&
    !placeOrder.isPending;

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      toast.error("Select a delivery address");
      return;
    }
    try {
      const result = await placeOrder.mutateAsync({
        paymentMethod,
        deliveryAddress: toDeliveryAddress(selectedAddress),
        idempotencyKey,
      });
      toast.success("Order placed successfully!");
      router.push(
        `/order-processing?orderRequestId=${encodeURIComponent(result.order.orderRequestId)}`,
      );
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to place order. Please try again.");
    }
  };

  // ── Signed-out: the server cart + checkout are auth-only ──
  if (!isAuthenticated) {
    return (
      <CheckoutShell>
        <Card className="border-2">
          <CardContent className="pt-12 pb-12 text-center space-y-4">
            <LogIn className="h-10 w-10 mx-auto text-muted-foreground" />
            <h3>Sign in to check out</h3>
            <p className="text-muted-foreground">Your cart and checkout live on your account.</p>
            <Button onClick={() => router.push("/login")}>Sign in</Button>
          </CardContent>
        </Card>
      </CheckoutShell>
    );
  }

  if (cartQuery.isLoading) {
    return (
      <CheckoutShell>
        <Card className="border-2">
          <CardContent className="pt-12 pb-12 text-center">
            <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </CheckoutShell>
    );
  }

  if (items.length === 0) {
    return (
      <CheckoutShell>
        <Card className="border-2">
          <CardContent className="pt-12 pb-12 text-center space-y-4">
            <ShoppingBag className="h-10 w-10 mx-auto text-muted-foreground" />
            <h3>Your cart is empty</h3>
            <p className="text-muted-foreground">Add some items to checkout</p>
            <Button onClick={() => router.push("/restaurants")}>Browse Restaurants</Button>
          </CardContent>
        </Card>
      </CheckoutShell>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="mb-2">Checkout</h2>
        <p className="text-muted-foreground">Complete your order</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* ── Delivery address ── */}
          <Card className="border-2 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" /> Delivery Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {addresses.length === 0 ? (
                <div className="text-center py-6 space-y-3">
                  <p className="text-sm text-muted-foreground">No saved addresses yet.</p>
                  <Button asChild variant="outline">
                    <Link href="/profile/addresses">Add an address</Link>
                  </Button>
                </div>
              ) : (
                <>
                  {addresses.map((addr) => {
                    const active = selectedAddressId === addr.id;
                    return (
                      <button
                        type="button"
                        key={addr.id}
                        onClick={() => setSelectedAddressId(addr.id)}
                        className={`w-full text-left flex items-start gap-3 p-3 rounded-lg border-2 transition-all ${
                          active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                        }`}
                      >
                        <div className="p-1.5 bg-accent rounded-md shrink-0 mt-0.5">
                          {labelIcon(addr.label)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-sm font-medium">{addr.label}</span>
                            {addr.isDefault && (
                              <Badge variant="secondary" className="text-xs px-1.5 py-0 gap-1">
                                <Star className="h-2.5 w-2.5 fill-current" /> Default
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm">{addr.recipientName} · {addr.phone}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {addr.addressLines}, {addr.city}, {addr.state} {addr.pinCode}
                          </p>
                        </div>
                        {active && (
                          <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                  <Link
                    href="/profile/addresses"
                    className="block text-xs text-primary text-center pt-1 hover:underline"
                  >
                    Manage addresses
                  </Link>
                </>
              )}
            </CardContent>
          </Card>

          {/* ── Payment method ── */}
          <Card className="border-2 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" /> Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
              >
                {PAYMENT_METHODS.map(({ value, label }) => (
                  <div
                    key={value}
                    className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-accent"
                  >
                    <RadioGroupItem value={value} id={`pm-${value}`} />
                    <Label htmlFor={`pm-${value}`} className="flex items-center gap-3 cursor-pointer flex-1">
                      {PAYMENT_ICON[value]}
                      <span>{label}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>
        </div>

        {/* ── Order summary ── */}
        <div className="lg:col-span-1">
          <div className="sticky top-4">
            <Card className="border-2 shadow-lg">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
                {preview && (
                  <p className="text-sm text-muted-foreground">
                    {preview.serviceable ? "Delivery available" : "Not serviceable here"}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {items.map((item) => (
                    <div key={item.cartItemId} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {item.quantity}x {item.name ?? "Item"}
                      </span>
                      <span>{item.formattedLineTotal}</span>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Pricing comes from the server preview; until an address is
                    picked we show the cart subtotal and prompt for selection. */}
                {!selectedAddress ? (
                  <p className="text-sm text-muted-foreground">
                    Select a delivery address to see fees, taxes and the total.
                  </p>
                ) : previewQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Calculating pricing…
                  </div>
                ) : previewQuery.isError ? (
                  <p className="text-sm text-destructive">
                    Couldn&apos;t calculate pricing for this address. Try another address.
                  </p>
                ) : preview ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{preview.pricing.formattedSubtotal}</span>
                    </div>
                    {preview.pricing.fees.map((fee) => (
                      <div key={fee.type} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{FEE_LABEL[fee.type] ?? fee.type}</span>
                        <span>{fee.formattedAmount}</span>
                      </div>
                    ))}
                    {(preview.pricing.discount.amount ?? 0) > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Discount</span>
                        <span>-{preview.pricing.formattedDiscount}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span>{preview.pricing.formattedTax}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="font-semibold">Total</span>
                      <span className="text-2xl font-bold">{preview.pricing.formattedTotal}</span>
                    </div>
                  </div>
                ) : null}

                {notServiceable && (
                  <p className="text-sm text-destructive">
                    This restaurant doesn&apos;t deliver to the selected address.
                  </p>
                )}
                {belowMinOrder && preview && (
                  <p className="text-sm text-destructive">
                    Minimum order is {preview.formattedMinOrder}. Add more items to continue.
                  </p>
                )}

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handlePlaceOrder}
                  disabled={!canPlaceOrder}
                >
                  {placeOrder.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…
                    </>
                  ) : (
                    "Place Order"
                  )}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  By placing this order, you agree to our Terms &amp; Conditions
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
