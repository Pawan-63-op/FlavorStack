"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { Minus, Plus, Trash2, ShoppingBag, Loader2, Tag, X, LogIn } from "lucide-react";
import { motion } from "motion/react";
import { useCart, useUpdateCartItem, useRemoveCartItem, useClearCart, useCartItemImages } from "@/lib/api/hooks/useCart";
import { useApplyPromotion, useRemovePromotion, useValidatePromotion } from "@/lib/api/hooks/usePromotion";
import { promotionAdapter } from "@/lib/api/adapters/cart";
import { ApiError } from "@/lib/api/errors/ApiError";
import { formatMoney } from "@/lib/api/format/money";
import { useAuthStore } from "@/store/authStore";
import { guestLineKey, useGuestCartStore } from "@/store/guestCartStore";
import { ImageWithFallback } from "../figma/ImageWithFallback";

/**
 * Guest cart (Batch 5.4) — staged locally while logged out (the server `/cart`
 * is auth-only). Items merge into the server cart on login; checkout requires
 * signing in. Subtotal is a local preview (minor units → major) — the server
 * is authoritative once merged.
 */
function GuestCartView() {
  const router = useRouter();
  const lines = useGuestCartStore((s) => s.lines);
  const setQuantity = useGuestCartStore((s) => s.setQuantity);
  const removeLine = useGuestCartStore((s) => s.removeLine);
  const clear = useGuestCartStore((s) => s.clear);

  const currency = lines[0]?.unitPrice.currency ?? "USD";
  const subtotalMinor = lines.reduce((sum, l) => sum + l.unitPrice.amount * l.quantity, 0);
  const formattedSubtotal = formatMoney({ amount: subtotalMinor / 100, currency });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-10 bg-background border-b py-4 px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-primary" />
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Your Cart</h1>
        </div>
        <Button variant="ghost" onClick={() => router.back()}>
          Continue Shopping
        </Button>
      </header>

      {lines.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 px-4 py-16">
          <div className="p-8 rounded-full bg-muted">
            <ShoppingBag className="h-12 w-12 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Your cart is empty</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Add some delicious items to get started.
            </p>
          </div>
          <Button size="lg" onClick={() => router.push("/")} className="px-6 py-2 text-base font-medium">
            Browse Menu
          </Button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col sm:flex-row">
          <ScrollArea className="flex-1 px-4 sm:px-8 py-6 max-h-[calc(100vh-10rem)]">
            <div className="space-y-4">
              {lines.map((line) => (
                <div
                  key={guestLineKey(line)}
                  className="flex items-center gap-4 p-4 rounded-xl border bg-card"
                >
                  <div className="w-24 h-24 flex-shrink-0 overflow-hidden rounded-lg border">
                    <ImageWithFallback
                      src={line.image}
                      alt={line.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <h4 className="font-medium text-sm sm:text-base truncate">{line.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {formatMoney({ amount: line.unitPrice.amount / 100, currency: line.unitPrice.currency })}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center gap-1 rounded-md border bg-background">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Decrease quantity"
                          onClick={() => setQuantity(guestLineKey(line), line.quantity - 1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center text-sm font-medium">{line.quantity}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Increase quantity"
                          onClick={() => setQuantity(guestLineKey(line), line.quantity + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive/90"
                        aria-label="Remove item"
                        onClick={() => removeLine(guestLineKey(line))}
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-right font-semibold text-sm sm:text-base">
                    {formatMoney({ amount: (line.unitPrice.amount * line.quantity) / 100, currency: line.unitPrice.currency })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <aside className="w-full sm:w-96 border-t sm:border-l sm:border-t-0 bg-muted/10 p-6 sm:p-8 flex flex-col justify-between">
            <div className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">Order Summary</h2>
              <div className="space-y-2 text-sm mt-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formattedSubtotal}</span>
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  Promotions, delivery fee and taxes are calculated after you sign in.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <Button asChild size="lg" className="w-full text-base font-semibold tracking-tight">
                <Link href={`/login?from=${encodeURIComponent("/cart")}`}>
                  <LogIn className="h-4 w-4 mr-2" />
                  Log in to check out
                </Link>
              </Button>
              <Button
                variant="ghost"
                className="w-full text-destructive hover:text-destructive/90"
                onClick={clear}
              >
                Clear cart
              </Button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

/**
 * Server-backed cart (Batch 5.2) + server-validated promotions (Batch 5.3).
 * Lines, quantities, totals and the applied discount all come from the
 * authoritative server cart; mutations key off the server `cartItemId`/promo
 * code and re-mirror the returned cart. No local total/discount math.
 */
export default function CartPage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: cart, isLoading, isError, error } = useCart();
  const itemImages = useCartItemImages(cart?.restaurantId);
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const clearCart = useClearCart();
  const applyPromotion = useApplyPromotion();
  const removePromotion = useRemovePromotion();
  const validatePromotion = useValidatePromotion();

  const [promoCode, setPromoCode] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [previewDiscount, setPreviewDiscount] = useState<string | null>(null);

  const items = cart?.items ?? [];
  const mutating = updateItem.isPending || removeItem.isPending || clearCart.isPending;
  const promoMutating = applyPromotion.isPending || removePromotion.isPending || validatePromotion.isPending;

  function promoErrorMessage(err: unknown, fallback: string): string {
    return err instanceof ApiError ? err.message : fallback;
  }

  async function handleApplyPromotion(): Promise<void> {
    const code = promoCode.trim();
    if (!code) return;
    setPromoError(null);
    try {
      await applyPromotion.mutateAsync(code);
      setPromoCode("");
      setPreviewDiscount(null);
    } catch (err) {
      setPromoError(promoErrorMessage(err, "Could not apply this promo code"));
    }
  }

  async function handleCheckPromotion(): Promise<void> {
    const code = promoCode.trim();
    if (!code) return;
    setPromoError(null);
    setPreviewDiscount(null);
    try {
      const result = await validatePromotion.mutateAsync(code);
      setPreviewDiscount(promotionAdapter(result.promotion).formattedDiscount);
    } catch (err) {
      setPromoError(promoErrorMessage(err, "Could not validate this promo code"));
    }
  }

  function handleRemovePromotion(): void {
    setPromoError(null);
    setPreviewDiscount(null);
    removePromotion.mutate();
  }

  // Logged out: the server cart is auth-only — show the local guest buffer with
  // a sign-in CTA (Batch 5.4). All hooks above run unconditionally first.
  if (!isAuthenticated) {
    return <GuestCartView />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b py-4 px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-primary" />
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Your Cart</h1>
        </div>
        <Button variant="ghost" onClick={() => router.back()}>
          Continue Shopping
        </Button>
      </header>

      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Loading your cart...</p>
        </div>
      ) : isError ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 px-4 text-center">
          <p className="text-destructive">Couldn&apos;t load your cart</p>
          <p className="text-sm text-muted-foreground">
            {error instanceof ApiError ? error.message : "Please try again."}
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 px-4 py-16">
          <div className="p-8 rounded-full bg-muted">
            <ShoppingBag className="h-12 w-12 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Your cart is empty</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Add some delicious items to get started.
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => router.push("/")}
            className="px-6 py-2 text-base font-medium"
          >
            Browse Menu
          </Button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col sm:flex-row">
          {/* Left: Cart Items */}
          <ScrollArea className="flex-1 px-4 sm:px-8 py-6 max-h-[calc(100vh-10rem)]">
            <div className="space-y-4">
              {items.map((item, index) => (
                <motion.div
                  key={item.cartItemId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:shadow-sm transition-all duration-200"
                >
                  {/* Image (server cart has no image → fallback) */}
                  <div className="w-24 h-24 flex-shrink-0 overflow-hidden rounded-lg border">
                    <ImageWithFallback
                      src={itemImages.get(item.menuItemId)}
                      alt={item.name ?? "Item"}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm sm:text-base truncate">
                          {item.name ?? "Item"}
                        </h4>
                        {!item.isAvailable && (
                          <Badge variant="destructive" className="text-xs">
                            Unavailable
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{item.formattedUnitPrice}</p>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center gap-1 rounded-md border bg-background">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Decrease quantity"
                          disabled={mutating}
                          onClick={() =>
                            updateItem.mutate({
                              cartItemId: item.cartItemId,
                              quantity: item.quantity - 1,
                            })
                          }
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Increase quantity"
                          disabled={mutating}
                          onClick={() =>
                            updateItem.mutate({
                              cartItemId: item.cartItemId,
                              quantity: item.quantity + 1,
                            })
                          }
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive/90"
                        aria-label="Remove item"
                        disabled={mutating}
                        onClick={() => removeItem.mutate(item.cartItemId)}
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>

                  {/* Total per line (server-computed) */}
                  <div className="text-right font-semibold text-foreground text-sm sm:text-base">
                    {item.formattedLineTotal}
                  </div>
                </motion.div>
              ))}
            </div>
          </ScrollArea>

          {/* Right: Order Summary */}
          <aside className="w-full sm:w-96 border-t sm:border-l sm:border-t-0 bg-muted/10 p-6 sm:p-8 flex flex-col justify-between">
            <div className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">Order Summary</h2>

              {/* Promotion code (Batch 5.3) — server-validated apply/validate/remove. */}
              <div className="pt-2">
                {cart?.appliedPromotion ? (
                  <div className="flex items-center justify-between rounded-md border bg-green-50 px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 text-green-700">
                      <Tag className="h-4 w-4" />
                      <span className="font-medium">{cart.appliedPromotion.code}</span> applied
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      aria-label="Remove promotion"
                      disabled={promoMutating}
                      onClick={handleRemovePromotion}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Promo code"
                        aria-label="Promo code"
                        value={promoCode}
                        disabled={!items.length || promoMutating}
                        onChange={(e) => {
                          setPromoCode(e.target.value);
                          setPromoError(null);
                          setPreviewDiscount(null);
                        }}
                      />
                      <Button
                        variant="outline"
                        disabled={!items.length || !promoCode.trim() || promoMutating}
                        onClick={handleCheckPromotion}
                      >
                        Check
                      </Button>
                      <Button
                        disabled={!items.length || !promoCode.trim() || promoMutating}
                        onClick={handleApplyPromotion}
                      >
                        Apply
                      </Button>
                    </div>
                    {promoError && <p className="text-xs text-destructive">{promoError}</p>}
                    {previewDiscount && !promoError && (
                      <p className="text-xs text-green-600">
                        This code saves {previewDiscount} — click Apply to use it.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2 text-sm mt-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{cart?.formattedSubtotal}</span>
                </div>
                {cart?.appliedPromotion && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount ({cart.appliedPromotion.code})</span>
                    <span>-{cart.appliedPromotion.formattedDiscount}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span>{cart?.formattedTotal}</span>
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  Delivery fee and taxes are calculated at checkout.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <Button
                size="lg"
                className="w-full text-base font-semibold tracking-tight"
                onClick={() => router.push("/checkout")}
              >
                Proceed to Checkout
              </Button>
              <Button
                variant="ghost"
                className="w-full text-destructive hover:text-destructive/90"
                disabled={mutating}
                onClick={() => clearCart.mutate()}
              >
                Clear cart
              </Button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
