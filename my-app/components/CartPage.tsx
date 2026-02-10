"use client";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { ScrollArea } from "./ui/scroll-area";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { motion } from "motion/react";
// import { useNavigate } from "react-router-dom";
import { useCartStore } from "../store/cartStore";
import { ImageWithFallback } from "../figma/ImageWithFallback";

export default function CartPage() {
  const router = useRouter();
  // const navigate = useNavigate();
  const cart = useCartStore((state) => state.cart);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeFromCart = useCartStore((state) => state.removeFromCart);
  const getCartTotal = useCartStore((state) => state.getCartTotal);

  const restaurantName = cart.length > 0 ? cart[0].restaurantName : "";

  const subtotal = getCartTotal();
  const deliveryFee = 2.99;
  const total = subtotal + deliveryFee;

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

      {/* Main Section */}
      {cart.length === 0 ? (
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
              {restaurantName && (
                <p className="text-sm text-muted-foreground mb-4">
                  From <span className="font-medium text-foreground">{restaurantName}</span>
                </p>
              )}

              {cart.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:shadow-sm transition-all duration-200"
                >
                  {/* Image */}
                  <div className="w-24 h-24 flex-shrink-0 overflow-hidden rounded-lg border">
                    <ImageWithFallback
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <h4 className="font-medium text-sm sm:text-base truncate">{item.name}</h4>
                      <p className="text-sm text-muted-foreground">${item.price.toFixed(2)}</p>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center gap-1 rounded-md border bg-background">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
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
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive/90"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>

                  {/* Total per item */}
                  <div className="text-right font-semibold text-foreground text-sm sm:text-base">
                    ${(item.price * item.quantity).toFixed(2)}
                  </div>
                </motion.div>
              ))}
            </div>
          </ScrollArea>

          {/* Right: Order Summary */}
          <aside className="w-full sm:w-96 border-t sm:border-l sm:border-t-0 bg-muted/10 p-6 sm:p-8 flex flex-col justify-between">
            <div className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">Order Summary</h2>
              <div className="space-y-2 text-sm mt-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery Fee</span>
                  <span>${deliveryFee.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <Button
              size="lg"
              className="w-full mt-6 text-base font-semibold tracking-tight"
              onClick={() => router.push("/checkout")}
            >
              Proceed to Checkout
            </Button>
          </aside>
        </div>
      )}
    </div>
  );
}
