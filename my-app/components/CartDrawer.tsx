"use client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from "./ui/sheet";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2, ShoppingBag, Loader2, LogIn } from "lucide-react";
import { useCart, useUpdateCartItem, useRemoveCartItem } from "@/lib/api/hooks/useCart";
import { formatMoney } from "@/lib/api/format/money";
import { useAuthStore } from "@/store/authStore";
import { useGuestCartStore } from "@/store/guestCartStore";
import { ImageWithFallback } from "../admin_new/src/components/figma/ImageWithFallback";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

/**
 * Guest drawer (Batch 5.4) — local staged buffer with a sign-in CTA; the server
 * `/cart` is auth-only. Dormant in the current app (the drawer only mounts
 * inside the auth-gated layout) but kept correct for a future public surface.
 */
function GuestCartDrawerBody({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const lines = useGuestCartStore((s) => s.lines);
  const setQuantity = useGuestCartStore((s) => s.setQuantity);
  const removeLine = useGuestCartStore((s) => s.removeLine);

  const subtotalMinor = lines.reduce((sum, l) => sum + l.unitPrice.amount * l.quantity, 0);
  const currency = lines[0]?.unitPrice.currency ?? "USD";

  if (lines.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-4">
        <ShoppingBag className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="mb-2 font-medium text-lg">Your cart is empty</h3>
        <p className="text-muted-foreground mb-4">Add delicious items to continue</p>
        <Button className="mt-2" onClick={onClose}>
          Browse Menu
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full px-3">
          <div className="space-y-4 py-4">
            {lines.map((line) => (
              <div key={line.menuItemId} className="flex gap-4 p-3 rounded-xl border bg-card shadow-sm">
                <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden">
                  <ImageWithFallback src={line.image} alt={line.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <h4 className="font-semibold text-base truncate">{line.name}</h4>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1 border rounded-lg bg-muted/40 shadow-inner">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label="Decrease quantity"
                        onClick={() => setQuantity(line.menuItemId, line.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-7 text-center text-sm font-medium">{line.quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label="Increase quantity"
                        onClick={() => setQuantity(line.menuItemId, line.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      aria-label="Remove item"
                      onClick={() => removeLine(line.menuItemId)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-right font-semibold">
                  {formatMoney({ amount: (line.unitPrice.amount * line.quantity) / 100, currency: line.unitPrice.currency })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="border-t bg-background shadow-lg p-5 sticky bottom-0 z-50 space-y-4">
        <div className="flex justify-between text-lg font-semibold">
          <span>Subtotal</span>
          <span>{formatMoney({ amount: subtotalMinor / 100, currency })}</span>
        </div>
        <Button
          className="w-full py-6 text-base font-semibold rounded-xl shadow-md"
          onClick={() => {
            onClose();
            router.push(`/login?from=${encodeURIComponent("/cart")}`);
          }}
        >
          <LogIn className="h-4 w-4 mr-2" />
          Log in to check out
        </Button>
      </div>
    </>
  );
}

/**
 * Server-backed cart drawer (Batch 5.2). Reads the authoritative cart via
 * `useCart()` and mutates by server `cartItemId`; all money is server-computed.
 * Falls back to the guest buffer when logged out (Batch 5.4).
 */
export function CartDrawer({ open, onClose, onCheckout }: CartDrawerProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: cart, isLoading } = useCart();
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();

  const items = cart?.items ?? [];
  const mutating = updateItem.isPending || removeItem.isPending;

  if (!isAuthenticated) {
    return (
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="p-5 border-b bg-background sticky top-0 z-50 shadow-sm">
            <SheetTitle className="flex items-center gap-2 text-lg font-semibold">
              <ShoppingBag className="h-5 w-5 text-primary" />
              Your Cart
            </SheetTitle>
            <SheetDescription className="text-sm">Sign in to check out</SheetDescription>
          </SheetHeader>
          <GuestCartDrawerBody onClose={onClose} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        {/* HEADER */}
        <SheetHeader className="p-5 border-b bg-background sticky top-0 z-50 shadow-sm">
          <SheetTitle className="flex items-center gap-2 text-lg font-semibold">
            <ShoppingBag className="h-5 w-5 text-primary" />
            Your Cart
          </SheetTitle>
          <SheetDescription className="text-sm">
            Review your items before checkout
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin" />
            <p className="text-sm">Loading your cart...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-4">
            <ShoppingBag className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="mb-2 font-medium text-lg">Your cart is empty</h3>
            <p className="text-muted-foreground mb-4">
              Add delicious items to continue
            </p>
            <Button className="mt-2" onClick={onClose}>
              Browse Menu
            </Button>
          </div>
        ) : (
          <>
            {/* CART ITEMS */}
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full px-3">
                <div className="space-y-4 py-4">
                  {items.map((item, index) => (
                    <motion.div
                      key={item.cartItemId}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex gap-4 p-3 rounded-xl border bg-card shadow-sm"
                    >
                      {/* IMAGE (server cart has no image → fallback) */}
                      <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden">
                        <ImageWithFallback
                          src={undefined}
                          alt={item.name ?? "Item"}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* DETAILS */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-base truncate">
                              {item.name ?? "Item"}
                            </h4>
                            {!item.isAvailable && (
                              <Badge variant="destructive" className="text-xs">
                                Unavailable
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {item.formattedUnitPrice}
                          </p>
                        </div>

                        {/* QUANTITY CONTROLS */}
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center gap-1 border rounded-lg bg-muted/40 shadow-inner">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={mutating}
                              onClick={() =>
                                updateItem.mutate({
                                  cartItemId: item.cartItemId,
                                  quantity: item.quantity - 1,
                                })
                              }
                            >
                              <Minus className="h-3 w-3" />
                            </Button>

                            <span className="w-7 text-center text-sm font-medium">
                              {item.quantity}
                            </span>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={mutating}
                              onClick={() =>
                                updateItem.mutate({
                                  cartItemId: item.cartItemId,
                                  quantity: item.quantity + 1,
                                })
                              }
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            disabled={mutating}
                            onClick={() => removeItem.mutate(item.cartItemId)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* PRICE (server-computed line total) */}
                      <div className="text-right font-semibold">
                        {item.formattedLineTotal}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* TOTAL SECTION (STICKY BOTTOM) */}
            <div className="border-t bg-background shadow-lg p-5 sticky bottom-0 z-50 space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{cart?.formattedSubtotal}</span>
                </div>

                {cart?.appliedPromotion && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount ({cart.appliedPromotion.code})</span>
                    <span>-{cart.appliedPromotion.formattedDiscount}</span>
                  </div>
                )}

                <Separator />

                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>{cart?.formattedTotal}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Delivery fee and taxes are calculated at checkout.
                </p>
              </div>

              {/* CHECKOUT BUTTON */}
              <Button
                className="w-full py-6 text-base font-semibold rounded-xl shadow-md"
                onClick={() => {
                  onCheckout();
                  onClose();
                }}
              >
                Proceed to Checkout
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
