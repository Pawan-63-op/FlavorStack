"use client";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Badge } from "./ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard, Wallet, Banknote, MapPin, Phone,
  User, Tag, Percent, Loader2, Home, Briefcase,
  MoreHorizontal, ChevronDown, ChevronUp, Star,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useCartStore } from "@/admin_new/src/store/cartStore";
import { useCouponStore } from "@/store/couponStore";
import { useLoyaltyStore } from "@/store/loyaltyStore";
import { useAddressStore } from "@/store/addressStore";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import Link from "next/link";

const LabelIcon = ({ label }: { label: string }) => {
  if (label === "Home") return <Home className="h-3.5 w-3.5" />;
  if (label === "Work") return <Briefcase className="h-3.5 w-3.5" />;
  return <MoreHorizontal className="h-3.5 w-3.5" />;
};

export function Checkout() {
  const router = useRouter();
  const { user } = useAuthStore();

  // Cart
  const cart = useCartStore((s) => s.cart);
  const getCartTotal = useCartStore((s) => s.getCartTotal);
  const createOrder = useCartStore((s) => s.createOrder);
  const isLoading = useCartStore((s) => s.isLoading);

  // Coupons
  const fetchCoupons = useCouponStore((s) => s.fetchCoupons);
  const availableCoupons = useCouponStore((s) => s.coupons);
  const applyCoupon = useCouponStore((s) => s.applyCoupon);
  const removeCoupon = useCouponStore((s) => s.removeAppliedCoupon);
  const calculateDiscount = useCouponStore((s) => s.calculateDiscount);
  const appliedCouponState = useCouponStore((s) => s.appliedCoupon);

  // Loyalty
  const earnPoints = useLoyaltyStore((s) => s.earnPoints);
  const tier = useLoyaltyStore((s) => s.tier);

  // Address book
  const { addresses, fetchAddresses, getDefault } = useAddressStore();

  useEffect(() => {
    fetchCoupons();
    fetchAddresses();
  }, []);

  // Delivery form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddressPicker, setShowAddressPicker] = useState(false);

  // Auto-fill from default address on mount
  useEffect(() => {
    const def = getDefault();
    if (def && !name && !phone && !address) {
      setName(def.name);
      setPhone(def.phone);
      setAddress(def.address);
      setSelectedAddressId(def._id);
    }
  }, [addresses]);

  const handleSelectAddress = (addr: typeof addresses[0]) => {
    setName(addr.name);
    setPhone(addr.phone);
    setAddress(addr.address);
    setSelectedAddressId(addr._id);
    setShowAddressPicker(false);
  };

  const handlePhoneChange = (val: string) => {
    setPhone(val.replace(/[^0-9\s\+\-\(\)]/g, ""));
    setSelectedAddressId(null);
  };

  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash" | "wallet">("card");
  const [couponCode, setCouponCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const restaurantName = cart[0]?.restaurantName ?? "";
  const restaurantId = cart[0]?.restaurantId ?? "";
  const deliveryTime    = cart.length > 0 ? cart[0].deliveryTime || "30-40 min" : "30-40 min";  // ← ADD 
  const subtotal = getCartTotal();
  const deliveryFee = appliedCouponState?.freeShipping ? 0 : 2.99;
  const tax = subtotal * 0.08;
  const discount = calculateDiscount(subtotal);
  const total = subtotal + deliveryFee + tax - discount;

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) { toast.error("Please enter a coupon code"); return; }
    applyCoupon(couponCode, subtotal);
    setCouponCode("");
  };

  const handleRemoveCoupon = () => {
    removeCoupon();
    setCouponCode("");
  };

  const handlePlaceOrder = async () => {
    if (!name.trim() || !address.trim() || !phone.trim()) {
      toast.error("Please fill in all delivery details");
      return;
    }
    if (cart.length === 0) { toast.error("Your cart is empty"); return; }

    setIsProcessing(true);
    try {
      let pointsMultiplier = 1;
      if (tier.name === "Silver") pointsMultiplier = 1.5;
      else if (tier.name === "Gold") pointsMultiplier = 2;
      else if (tier.name === "Platinum") pointsMultiplier = 3;
      const pointsEarned = Math.floor(total * pointsMultiplier);

      const orderData = {
        restaurant: restaurantId || "",
        restaurantName,
        items: cart.map((item) => ({
          menuItem: String(item.id || ""),
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        subtotal, deliveryFee, tax, discount, total,
        couponApplied: appliedCouponState
          ? { code: appliedCouponState.code, discount }
          : undefined,
        deliveryAddress: {
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
        },
        paymentMethod,
        status: "pending" as const,
        pointsEarned,
        hasReview: false,
      };

      const createdOrder = await createOrder(orderData);
      await earnPoints(pointsEarned, `Order #${createdOrder.orderId} from ${restaurantName}`);
      if (appliedCouponState) removeCoupon();

      toast.success("Order placed successfully!");
      // router.push(
      //   `/order-processing?orderId=${createdOrder.orderId}&orderMongoId=${createdOrder._id}&restaurantName=${restaurantName}&total=${total}&pointsEarned=${pointsEarned}`
      // );
      router.push(
  `/order-processing?orderId=${encodeURIComponent(createdOrder.orderId)}&orderMongoId=${encodeURIComponent(createdOrder._id)}&restaurantName=${encodeURIComponent(restaurantName)}&total=${total}&pointsEarned=${pointsEarned}&deliveryTime=${encodeURIComponent(deliveryTime)}`
);
    } catch (error: any) {
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
            <Button onClick={() => router.push("/restaurants")}>Browse Restaurants</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h2 className="mb-2">Checkout</h2>
        <p className="text-muted-foreground">Complete your order from {restaurantName}</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* ── Delivery Details ── */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-2 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" /> Delivery Details
                  </CardTitle>
                  {addresses.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => setShowAddressPicker((v) => !v)}
                    >
                      Saved addresses
                      {showAddressPicker
                        ? <ChevronUp className="h-3 w-3" />
                        : <ChevronDown className="h-3 w-3" />}
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Saved address picker */}
                <AnimatePresence>
                  {showAddressPicker && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-2 pb-3">
                        {addresses.map((addr) => (
                          <div
                            key={addr._id}
                            onClick={() => handleSelectAddress(addr)}
                            className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                              selectedAddressId === addr._id
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/40"
                            }`}
                          >
                            <div className="p-1.5 bg-accent rounded-md shrink-0">
                              <LabelIcon label={addr.label} />
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
                              <p className="text-xs text-muted-foreground truncate">{addr.address}</p>
                            </div>
                            {selectedAddressId === addr._id && (
                              <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                                <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                              </div>
                            )}
                          </div>
                        ))}
                        <Link
                          href="/profile/addresses"
                          className="block text-xs text-primary text-center pt-1 hover:underline"
                        >
                          Manage addresses
                        </Link>
                      </div>
                      <Separator className="mb-4" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Manual fields — always visible, auto-filled when address selected */}
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name" placeholder="John Doe" value={name}
                      onChange={(e) => { setName(e.target.value); setSelectedAddressId(null); }}
                      className="pl-10" required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone" type="tel" placeholder="+1 (555) 123-4567" value={phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      className="pl-10" maxLength={15} required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Delivery Address *</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="address" placeholder="123 Main Street, Apt 4B" value={address}
                      onChange={(e) => { setAddress(e.target.value); setSelectedAddressId(null); }}
                      className="pl-10" required
                    />
                  </div>
                </div>

                {addresses.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Want to save this for next time?{" "}
                    <Link href="/profile/addresses" className="text-primary hover:underline">
                      Add to address book
                    </Link>
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* ── Payment Method ── */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="border-2 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" /> Payment Method
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
                  {[
                    { value: "card",   icon: <CreditCard className="h-5 w-5 text-muted-foreground" />, label: "Credit / Debit Card", sub: "Visa, Mastercard, Amex" },
                    { value: "wallet", icon: <Wallet className="h-5 w-5 text-muted-foreground" />,     label: "Digital Wallet",       sub: "Apple Pay, Google Pay" },
                    { value: "cash",   icon: <Banknote className="h-5 w-5 text-muted-foreground" />,   label: "Cash on Delivery",     sub: "Pay when you receive" },
                  ].map(({ value, icon, label, sub }) => (
                    <div key={value} className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-accent cursor-pointer">
                      <RadioGroupItem value={value} id={value} />
                      <Label htmlFor={value} className="flex items-center gap-3 cursor-pointer flex-1">
                        {icon}
                        <div><p>{label}</p><p className="text-sm text-muted-foreground">{sub}</p></div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>
          </motion.div>

          {/* ── Coupon ── */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="border-2 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" /> Promo Code
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
                              : appliedCouponState.freeShipping ? "Free shipping"
                              : `$${appliedCouponState.discount} off`}
                          </p>
                          <p className="text-xs text-green-600 mt-1">✓ Coupon Applied Successfully</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={handleRemoveCoupon}>Remove</Button>
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
                      <Button onClick={handleApplyCoupon} size="lg" className="px-6">Apply</Button>
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
                            className="p-4 bg-gradient-to-r from-primary/5 to-purple-500/5 border-2 border-primary/20 rounded-xl cursor-pointer hover:border-primary/40 transition-all"
                            onClick={() => applyCoupon(coupon.code, subtotal)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="default" className="text-sm px-3 py-1">{coupon.code}</Badge>
                                  {coupon.type === "percentage" && <span className="text-lg font-bold text-primary">{coupon.discount}% OFF</span>}
                                  {coupon.type === "fixed" && <span className="text-lg font-bold text-primary">${coupon.discount} OFF</span>}
                                  {coupon.freeShipping && <span className="text-lg font-bold text-primary">FREE SHIPPING</span>}
                                </div>
                                <p className="text-sm text-muted-foreground mb-1">
                                  {coupon.type === "percentage" ? `Get ${coupon.discount}% off your order`
                                    : coupon.freeShipping ? "Free shipping on your order"
                                    : `Save $${coupon.discount} on your order`}
                                </p>
                                {coupon.minOrder && (
                                  <p className="text-xs text-muted-foreground">Min. order: ${coupon.minOrder.toFixed(2)}</p>
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

        {/* ── Order Summary ── */}
        <div className="lg:col-span-1">
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }} className="sticky top-4"
          >
            <Card className="border-2 shadow-lg">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
                <p className="text-sm text-muted-foreground">From {restaurantName}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.quantity}x {item.name}</span>
                      <span>${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <Separator />
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
                      <span>Free Delivery</span><span>-$2.99</span>
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
                      You saved ${discount.toFixed(2)}!
                    </div>
                  )}
                  {tier.name !== "Bronze" && (
                    <div className="text-center text-xs text-primary p-2 bg-primary/5 rounded">
                      {tier.name} member: Earning {tier.name === "Silver" ? "1.5x" : tier.name === "Gold" ? "2x" : "3x"} points!
                    </div>
                  )}
                </div>

                <Button className="w-full" size="lg" onClick={handlePlaceOrder}
                  disabled={isProcessing || isLoading}>
                  {isProcessing || isLoading
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                    : "Place Order"}
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
