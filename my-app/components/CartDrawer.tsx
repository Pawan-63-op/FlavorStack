"use client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from "./ui/sheet";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { motion } from "motion/react";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useCartStore } from "@/admin_new/src/store/cartStore";
import { ImageWithFallback } from "../admin_new/src/components/figma/ImageWithFallback";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

export function CartDrawer({ open, onClose, onCheckout }: CartDrawerProps) {
  const cart = useCartStore((state) => state.cart);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeFromCart = useCartStore((state) => state.removeFromCart);
  const getCartTotal = useCartStore((state) => state.getCartTotal);

  const restaurantName = cart.length > 0 ? cart[0].restaurantName : "";

  const deliveryFee = 2.99;
  const subtotal = getCartTotal();
  const finalTotal = subtotal + deliveryFee;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        {/* HEADER */}
        <SheetHeader className="p-5 border-b bg-background sticky top-0 z-50 shadow-sm">
          <SheetTitle className="flex items-center gap-2 text-lg font-semibold">
            <ShoppingBag className="h-5 w-5 text-primary" />
            Your Cart
          </SheetTitle>

          {restaurantName && (
            <SheetDescription className="text-sm">
              From <span className="font-medium">{restaurantName}</span>
            </SheetDescription>
          )}
        </SheetHeader>

        {/* EMPTY CART */}
        {cart.length === 0 ? (
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
                  {cart.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex gap-4 p-3 rounded-xl border bg-card shadow-sm"
                    >
                      {/* IMAGE */}
                      <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden">
                        <ImageWithFallback
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* DETAILS */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <h4 className="font-semibold text-base truncate">
                            {item.name}
                          </h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            ${item.price.toFixed(2)}
                          </p>
                        </div>

                        {/* QUANTITY CONTROLS */}
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center gap-1 border rounded-lg bg-muted/40 shadow-inner">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() =>
                                updateQuantity(item.id, item.quantity - 1)
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
                              onClick={() =>
                                updateQuantity(item.id, item.quantity + 1)
                              }
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* PRICE */}
                      <div className="text-right font-semibold">
                        ${(item.price * item.quantity).toFixed(2)}
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
                  <span>${subtotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Delivery Fee</span>
                  <span>${deliveryFee.toFixed(2)}</span>
                </div>

                <Separator />

                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>${finalTotal.toFixed(2)}</span>
                </div>
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
