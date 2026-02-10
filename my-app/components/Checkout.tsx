"use client";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
// import { Button } from "./ui/button";
import{ Button} from "@/components/ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Badge } from "./ui/badge";
import { motion } from "motion/react";
import { CreditCard, Wallet, Banknote, MapPin, Phone, User, Tag, Percent, Loader2 } from "lucide-react";
import { useState } from "react";
import { useCartStore } from "@/admin_new/src/store/cartStore";
// import { useCartStore } from "@/store/cartStore";
import { useCouponStore } from "@/store/couponStore";
import { useLoyaltyStore } from "@/store/loyaltyStore";
import { toast } from "sonner";

import { useEffect } from "react";
interface CheckoutProps {
  onNavigate: (page: string, data?: any) => void;
}

export function Checkout() {
  const router = useRouter();
  const cart = useCartStore((state) => state.cart);
  const getCartTotal = useCartStore((state) => state.getCartTotal);
  const createOrder = useCartStore((state) => state.createOrder);
  const isLoading = useCartStore((state) => state.isLoading);
  const fetchCoupons = useCouponStore((state) => state.fetchCoupons);
  const availableCoupons = useCouponStore((state) => state.coupons);
  const applyCoupon = useCouponStore((state) => state.applyCoupon);
  const removeCoupon = useCouponStore((state) => state.removeAppliedCoupon);
  const calculateDiscount = useCouponStore((state) => state.calculateDiscount);
  const appliedCouponState = useCouponStore((state) => state.appliedCoupon);
  useEffect(() => {
  fetchCoupons();
}, []);
  
  const earnPoints = useLoyaltyStore((state) => state.earnPoints);
  const tier = useLoyaltyStore((state) => state.tier);
  
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash" | "wallet">("card");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const restaurantName = cart.length > 0 ? cart[0].restaurantName : "";
  const restaurantId = cart.length > 0 ? cart[0].restaurantId : "";
  const subtotal = getCartTotal();
  const deliveryFee = appliedCouponState?.freeShipping ? 0 : 2.99;
  const tax = subtotal * 0.08;
  const discount = calculateDiscount(subtotal);
  const total = subtotal + deliveryFee + tax - discount;

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) {
      toast.error("Please enter a coupon code");
      return;
    }
    applyCoupon(couponCode, subtotal);
    setCouponCode("");
  };

  const handleRemoveCoupon = () => {
    removeCoupon();
    setCouponCode("");
  };

  const handlePlaceOrder = async () => {
    // Validation
    console.log(cart.length,"cart length");
    if (!name.trim() || !address.trim() || !phone.trim()) {
      toast.error("Please fill in all delivery details");
      return;
    }

    if (cart.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    setIsProcessing(true);

    try {
      // Calculate loyalty points based on tier multiplier
      let pointsMultiplier = 1;
      if (tier.name === "Silver") pointsMultiplier = 1.5;
      else if (tier.name === "Gold") pointsMultiplier = 2;
      else if (tier.name === "Platinum") pointsMultiplier = 3;
      
      const pointsEarned = Math.floor(total * pointsMultiplier);

      // Prepare order data matching the Order model schema
    const orderData = {
      restaurant: (restaurantId || ""), // ✅ ensure it's always a string
      restaurantName,
      
  items: cart.map(item => ({
    menuItem: String(item.id || ""),
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        subtotal,
        deliveryFee,
        tax,
        discount,
        total,
        couponApplied: appliedCouponState ? {
          code: appliedCouponState.code,
          discount: discount
        } : undefined,
        deliveryAddress: {
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim()
        },
        paymentMethod,
        status: "pending" as const, // Initial status
        pointsEarned,
        hasReview: false
      };

      // Create order in backend
      const x = restaurantId|| "op" ;
      console.log("Restaurant ID in orderData:", x);
      const createdOrder = await createOrder(orderData);
      
      // Award loyalty points
      await earnPoints(pointsEarned, `Order #${createdOrder.orderId} from ${restaurantName}`);
      
      // Remove applied coupon after successful order
      if (appliedCouponState) {
        removeCoupon();
      }

      // Success toast
      toast.success("Order placed successfully!");
      router.push(
        `/order-processing?orderId=${createdOrder.orderId}&orderMongoId=${createdOrder._id}&restaurantName=${restaurantName}&total=${total}&pointsEarned=${pointsEarned}`
      );
      // Navigate to order processing page
      // onNavigate("order-processing", {
      //   orderId: createdOrder.orderId,
      //   orderMongoId: createdOrder._id,
      //   restaurantName,
      //   total,
      //   pointsEarned
      // });
      
    } catch (error: any) {
      console.error("Order placement error:", error);
      toast.error(error.message || "Failed to place order. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <Card className="border-2">
          <CardContent className="pt-12 pb-12 text-center">
            <h3 className="mb-2">Your cart is empty</h3>
            <p className="text-muted-foreground mb-4">Add some items to checkout</p>
            <Button onClick={() => router.push("/home")}>Browse Restaurants</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h2 className="mb-2">Checkout</h2>
        <p className="text-muted-foreground">Complete your order from {restaurantName}</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Delivery Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-2 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Delivery Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      placeholder="+1 (555) 123-4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Delivery Address *</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="address"
                      placeholder="123 Main Street, Apt 4B"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Payment Method */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-2 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Method
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={paymentMethod} onValueChange={(value:any) => setPaymentMethod(value as "card" | "cash" | "wallet")}>
                  <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-accent cursor-pointer">
                    <RadioGroupItem value="card" id="card" />
                    <Label htmlFor="card" className="flex items-center gap-3 cursor-pointer flex-1">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p>Credit / Debit Card</p>
                        <p className="text-sm text-muted-foreground">Visa, Mastercard, Amex</p>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-accent cursor-pointer">
                    <RadioGroupItem value="wallet" id="wallet" />
                    <Label htmlFor="wallet" className="flex items-center gap-3 cursor-pointer flex-1">
                      <Wallet className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p>Digital Wallet</p>
                        <p className="text-sm text-muted-foreground">Apple Pay, Google Pay</p>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-accent cursor-pointer">
                    <RadioGroupItem value="cash" id="cash" />
                    <Label htmlFor="cash" className="flex items-center gap-3 cursor-pointer flex-1">
                      <Banknote className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p>Cash on Delivery</p>
                        <p className="text-sm text-muted-foreground">Pay when you receive</p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          </motion.div>

          {/* Coupon Code */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-2 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Promo Code
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {appliedCouponState ? (
                  <div className="p-5 bg-green-500/10 border-2 border-green-500 rounded-xl">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500 rounded-full">
                          <Tag className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="font-bold text-green-700 dark:text-green-400 text-lg">{appliedCouponState.code}</p>
                          <p className="text-sm text-muted-foreground">
                            {appliedCouponState.type === "percentage" 
                              ? `${appliedCouponState.discount}% discount` 
                              : appliedCouponState.freeShipping
                              ? "Free shipping"
                              : `$${appliedCouponState.discount} off`}
                          </p>
                          <p className="text-xs text-green-600 mt-1">✓ Coupon Applied Successfully</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveCoupon}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2 p-4 bg-muted/50 rounded-lg border-2 border-dashed">
                      <Input
                        placeholder="Enter coupon code (e.g. WELCOME10)"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        className="flex-1 bg-background"
                      />
                      <Button onClick={handleApplyCoupon} size="lg" className="px-6">
                        Apply
                      </Button>
                    </div>
                    {availableCoupons.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">Available Coupons</p>
                          <Badge variant="secondary">{availableCoupons.length} codes</Badge>
                        </div>
                        {availableCoupons.map((coupon) => (
                          <motion.div
                            key={coupon.code}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="p-4 bg-gradient-to-r from-primary/5 to-purple-500/5 border-2 border-primary/20 rounded-xl cursor-pointer hover:border-primary/40 transition-all shadow-sm hover:shadow-md"
                            onClick={() => {
                              applyCoupon(coupon.code, subtotal);
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="default" className="text-sm px-3 py-1">
                                    {coupon.code}
                                  </Badge>
                                  {coupon.type === "percentage" && (
                                    <span className="text-lg font-bold text-primary">{coupon.discount}% OFF</span>
                                  )}
                                  {coupon.type === "fixed" && (
                                    <span className="text-lg font-bold text-primary">${coupon.discount} OFF</span>
                                  )}
                                  {coupon.freeShipping && (
                                    <span className="text-lg font-bold text-primary">FREE SHIPPING</span>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mb-1">
                                  {coupon.type === "percentage" 
                                    ? `Get ${coupon.discount}% off your order` 
                                    : coupon.freeShipping
                                    ? "Free shipping on your order"
                                    : `Save $${coupon.discount} on your order`}
                                </p>
                                {coupon.minOrder && (
                                  <p className="text-xs text-muted-foreground">
                                    Min. order: ${coupon.minOrder.toFixed(2)}
                                  </p>
                                )}
                              </div>
                              <div className="p-3 bg-primary/10 rounded-full">
                                <Percent className="h-6 w-6 text-primary" />
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Right Column - Order Summary */}
        <div className="lg:col-span-1">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="sticky top-4"
          >
            <Card className="border-2 shadow-lg">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
                <p className="text-sm text-muted-foreground">From {restaurantName}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Items */}
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {item.quantity}x {item.name}
                      </span>
                      <span>${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Pricing */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivery Fee</span>
                    <span className={appliedCouponState?.freeShipping ? "line-through text-muted-foreground" : ""}>
                      ${(appliedCouponState?.freeShipping ? 2.99 : deliveryFee).toFixed(2)}
                    </span>
                  </div>
                  {appliedCouponState?.freeShipping && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Free Delivery</span>
                      <span>-$2.99</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax (8%)</span>
                    <span>${tax.toFixed(2)}</span>
                  </div>
                  {discount > 0 && !appliedCouponState?.freeShipping && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount ({appliedCouponState?.code})</span>
                      <span>-${discount.toFixed(2)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="text-2xl font-bold">${total.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="text-center text-sm text-green-600 font-medium">
                      🎉 You saved ${discount.toFixed(2)}!
                    </div>
                  )}
                  {tier.name !== "Bronze" && (
                    <div className="text-center text-xs text-primary p-2 bg-primary/5 rounded">
                      {tier.name} member: Earning {tier.name === "Silver" ? "1.5x" : tier.name === "Gold" ? "2x" : "3x"} points!
                    </div>
                  )}
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handlePlaceOrder}
                  disabled={isProcessing || isLoading}
                >
                  {isProcessing || isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Place Order"
                  )}
                </Button>
                
                <p className="text-xs text-center text-muted-foreground">
                  By placing this order, you agree to our Terms & Conditions
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}