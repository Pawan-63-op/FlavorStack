"use client";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { motion } from "motion/react";
import {
  Package, Clock, CheckCircle, XCircle, ChefHat,
  Truck, Star, Eye, RotateCcw, Navigation,
} from "lucide-react";
import { useCartStore } from "@/admin_new/src/store/cartStore";
import { useReviewStore } from "../store/reviewStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle,
} from "./ui/dialog";
import { useState, useEffect } from "react";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { StarRating } from "./StarRating";
import { toast } from "sonner";
import { ScrollArea } from "./ui/scroll-area";
import { useRouter } from "next/navigation";

const ACTIVE_STATUSES = ["pending", "confirmed", "preparing", "out-for-delivery"];

type OrderType = ReturnType<typeof useCartStore.getState>["orders"][0];

export function OrderHistory() {
  const router      = useRouter();
  const fetchOrders = useCartStore((s) => s.fetchOrders);
  const orders      = useCartStore((s) => s.orders);
  const addToCart   = useCartStore((s) => s.addToCart);
  const canReview   = useReviewStore((s) => s.canReview);

  useEffect(() => { fetchOrders(); }, []);

  // ── Single review dialog state — no DialogTrigger, fully controlled ────────
  const [reviewOpen, setReviewOpen]         = useState(false);
  const [reviewingOrder, setReviewingOrder] = useState<OrderType | null>(null);
  const [reviewRating, setReviewRating]     = useState(0);
  const [reviewComment, setReviewComment]   = useState("");
  const [reviewName, setReviewName]         = useState("");
  const [reviewEmail, setReviewEmail]       = useState("");

  // ── Details dialog ─────────────────────────────────────────────────────────
  const [detailsOpen, setDetailsOpen]     = useState(false);
  const [viewingOrder, setViewingOrder]   = useState<OrderType | null>(null);

  const latestOrder = orders[0];
  const pastOrders  = orders.slice(1);

  // Open review dialog — set order first, then open
  const openReview = (order: OrderType) => {
    setReviewingOrder(order);
    setReviewRating(0);
    setReviewComment("");
    setReviewName("");
    setReviewEmail("");
    setReviewOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!reviewingOrder) return;
    if (!reviewName.trim())    { toast.error("Please enter your name"); return; }
    if (!reviewEmail.trim())   { toast.error("Please enter your email"); return; }
    if (reviewRating === 0)    { toast.error("Please select a rating"); return; }
    if (!reviewComment.trim()) { toast.error("Please write a review"); return; }

    try {
      const res = await fetch("http://localhost:8000/api/reviews", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order:      reviewingOrder.orderId || reviewingOrder._id,
          restaurant: reviewingOrder.restaurant,
          rating:     reviewRating,
          comment:    reviewComment,
          name:       reviewName,
          email:      reviewEmail,
          photos:     [],
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || "Failed to submit review"); return; }
      toast.success("Review submitted successfully!");
      setReviewOpen(false);
    } catch {
      toast.error("Something went wrong");
    }
  };

  const handleReorder = (order: OrderType) => {
    order.items.forEach((item) =>
      addToCart({
        id: item.id,
        restaurantId: item.restaurantId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        restaurantName: String(order.restaurantName),
        image: "",
      })
    );
    toast.success("Items added to cart!");
    router.push("/restaurants");
  };

  const handleTrackOrder = (order: OrderType) => {
    router.push(
      `/order-processing?orderId=${encodeURIComponent(order.orderId)}&orderMongoId=${encodeURIComponent(order._id)}&restaurantName=${encodeURIComponent(String(order.restaurantName))}&total=${order.total}&pointsEarned=${order.pointsEarned || 0}&deliveryTime=${encodeURIComponent("30-40 min")}`
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":          return <Clock className="h-4 w-4" />;
      case "confirmed":        return <CheckCircle className="h-4 w-4" />;
      case "preparing":        return <ChefHat className="h-4 w-4" />;
      case "out-for-delivery": return <Truck className="h-4 w-4" />;
      case "Delivered":        return <Truck className="h-4 w-4" />;
      case "cancelled":        return <XCircle className="h-4 w-4" />;
      default:                 return <Package className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":          return "bg-yellow-500";
      case "confirmed":        return "bg-blue-500";
      case "preparing":        return "bg-purple-500";
      case "out-for-delivery": return "bg-indigo-500";
      case "Delivered":        return "bg-green-500";
      case "cancelled":        return "bg-red-500";
      default:                 return "bg-gray-500";
    }
  };

  const formatStatus = (status: string) =>
    status === "out-for-delivery"
      ? "Out for Delivery"
      : status.charAt(0).toUpperCase() + status.slice(1);

  // ── Shared action buttons row ──────────────────────────────────────────────
  const ActionButtons = ({ order }: { order: OrderType }) => (
    <div className="grid grid-cols-2 gap-2">
      <Button variant="outline" className="gap-2"
        onClick={() => { setViewingOrder(order); setDetailsOpen(true); }}>
        <Eye className="h-4 w-4" /> Details
      </Button>

      <Button variant="outline" className="gap-2"
        onClick={() => handleReorder(order)}>
        <RotateCcw className="h-4 w-4" /> Reorder
      </Button>

      {/* Track — active orders only */}
      {ACTIVE_STATUSES.includes(order.status) && (
        <Button className="col-span-2 gap-2"
          onClick={() => handleTrackOrder(order)}>
          <Navigation className="h-4 w-4" /> Track Order
        </Button>
      )}

      {/* Review — delivered orders only, plain button, no DialogTrigger */}
      {order.status === "Delivered" && canReview(order._id) && (
        <Button className="col-span-2 gap-2"
          onClick={() => openReview(order)}>
          <Star className="h-4 w-4" /> Leave Review
        </Button>
      )}
    </div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="mb-2">My Orders</h2>
        <p className="text-muted-foreground">Track your current and past orders</p>
      </motion.div>

      <Tabs defaultValue="latest" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="latest">Latest Order</TabsTrigger>
          <TabsTrigger value="history">Order History</TabsTrigger>
        </TabsList>

        {/* ── Latest Order ── */}
        <TabsContent value="latest" className="space-y-6 mt-6">
          {latestOrder ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-2 shadow-lg">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 flex-wrap">
                        Order #{latestOrder.orderId}
                        <Badge className={`${getStatusColor(latestOrder.status)} border-0`}>
                          {formatStatus(latestOrder.status)}
                        </Badge>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {String(latestOrder.restaurantName)} • {latestOrder.date}
                      </p>
                    </div>
                    <p className="text-xl">${latestOrder.total.toFixed(2)}</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Status timeline */}
                  <div className="space-y-4">
                    <h4>Order Status</h4>
                    <div className="space-y-3">
                      {["pending", "confirmed", "preparing", "out-for-delivery", "Delivered"].map((status, i) => {
                        const order = ["pending", "confirmed", "preparing", "out-for-delivery", "Delivered"];
                        const isActive  = order.indexOf(latestOrder.status) >= i;
                        const isCurrent = latestOrder.status === status;
                        return (
                          <div key={status} className="flex items-center gap-3">
                            <div className={`p-2 rounded-full text-white ${isActive ? getStatusColor(status) : "bg-muted"}`}>
                              {getStatusIcon(status)}
                            </div>
                            <p className={isCurrent ? "font-medium" : "text-muted-foreground"}>
                              {formatStatus(status)}
                            </p>
                            {isCurrent && <Badge variant="secondary" className="ml-auto">Current</Badge>}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  {/* Items */}
                  <div className="space-y-3">
                    <h4>Order Items</h4>
                    {latestOrder.items.map((item, i) => (
                      <div key={i} className="flex justify-between items-center py-2">
                        <div>
                          <p>{item.name}</p>
                          <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                        </div>
                        <p>${(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* Totals */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>${latestOrder.subtotal?.toFixed(2) ?? latestOrder.total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delivery Fee</span>
                      <span>${latestOrder.deliveryFee?.toFixed(2) ?? "2.99"}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span className="text-xl">${latestOrder.total.toFixed(2)}</span>
                    </div>
                  </div>

                  <ActionButtons order={latestOrder} />
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <Card className="border-2">
              <CardContent className="pt-12 pb-12 text-center">
                <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="mb-2">No active orders</h3>
                <p className="text-muted-foreground">Your recent orders will appear here</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Order History ── */}
        <TabsContent value="history" className="space-y-4 mt-6">
          {pastOrders.length > 0 ? (
            pastOrders.map((order, index) => (
              <motion.div key={order._id}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}>
                <Card className="border-2 shadow-md hover:shadow-lg transition-all">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4>Order #{order.orderId}</h4>
                          <Badge className={`${getStatusColor(order.status)} border-0`}>
                            {formatStatus(order.status)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {String(order.restaurantName)} • {order.date}
                        </p>
                      </div>
                      <p className="text-xl">${order.total.toFixed(2)}</p>
                    </div>

                    <div className="space-y-1.5 mb-4">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{item.quantity}x {item.name}</span>
                          <span>${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    <Separator className="my-4" />
                    <ActionButtons order={order} />
                  </CardContent>
                </Card>
              </motion.div>
            ))
          ) : (
            <Card className="border-2">
              <CardContent className="pt-12 pb-12 text-center">
                <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="mb-2">No order history</h3>
                <p className="text-muted-foreground">Your past orders will appear here</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Single controlled Review Dialog ── */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review {reviewingOrder?.restaurantName}</DialogTitle>
            <DialogDescription>Share your experience with this order</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Your Name *</Label>
              <Input placeholder="Enter your name" value={reviewName}
                onChange={(e) => setReviewName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Your Email *</Label>
              <Input type="email" placeholder="Enter your email" value={reviewEmail}
                onChange={(e) => setReviewEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Rating *</Label>
              <StarRating rating={reviewRating} onRatingChange={setReviewRating} size="lg" />
            </div>
            <div className="space-y-2">
              <Label>Review *</Label>
              <Textarea placeholder="Tell us about your experience..."
                value={reviewComment} rows={4}
                onChange={(e) => setReviewComment(e.target.value)} />
            </div>
            <Button onClick={handleSubmitReview} className="w-full">Submit Review</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Order Details Dialog ── */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>Order #{viewingOrder?.orderId}</DialogDescription>
          </DialogHeader>
          {viewingOrder && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-5 pr-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className={`${getStatusColor(viewingOrder.status)} border-0`}>
                    {formatStatus(viewingOrder.status)}
                  </Badge>
                </div>
                <Separator />
                <div>
                  <h4 className="mb-2">Restaurant</h4>
                  <div className="flex items-center gap-2">
                    <ChefHat className="h-4 w-4 text-muted-foreground" />
                    <span>{String(viewingOrder.restaurantName)}</span>
                  </div>
                </div>

                {viewingOrder.deliveryAddress && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="mb-2">Delivery Address</h4>
                      <div className="p-3 bg-accent rounded-lg space-y-1 text-sm">
                        <p className="font-medium">{viewingOrder.deliveryAddress.name}</p>
                        <p className="text-muted-foreground">{viewingOrder.deliveryAddress.phone}</p>
                        <p className="text-muted-foreground">{viewingOrder.deliveryAddress.address}</p>
                      </div>
                    </div>
                  </>
                )}

                <Separator />
                <div>
                  <h4 className="mb-3">Order Items</h4>
                  <div className="space-y-2">
                    {viewingOrder.items.map((item, i) => (
                      <div key={i} className="flex justify-between items-center p-3 bg-accent rounded-lg">
                        <div>
                          <p>{item.name}</p>
                          <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                        </div>
                        <span>${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${viewingOrder.subtotal?.toFixed(2) ?? viewingOrder.total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery Fee</span>
                    <span>${viewingOrder.deliveryFee?.toFixed(2) ?? "2.99"}</span>
                  </div>
                  {viewingOrder.discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-${viewingOrder.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span className="text-xl">${viewingOrder.total.toFixed(2)}</span>
                  </div>
                </div>

                <Separator />
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order Date</span>
                    <span>{viewingOrder.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment</span>
                    <span className="capitalize">{viewingOrder.paymentMethod}</span>
                  </div>
                  {viewingOrder.pointsEarned > 0 && (
                    <div className="flex justify-between text-amber-600">
                      <span>Points Earned</span>
                      <span>+{viewingOrder.pointsEarned}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1 gap-2"
                    onClick={() => handleReorder(viewingOrder)}>
                    <RotateCcw className="h-4 w-4" /> Reorder
                  </Button>
                  {ACTIVE_STATUSES.includes(viewingOrder.status) && (
                    <Button className="flex-1 gap-2"
                      onClick={() => { setDetailsOpen(false); handleTrackOrder(viewingOrder); }}>
                      <Navigation className="h-4 w-4" /> Track Order
                    </Button>
                  )}
                  {viewingOrder.status === "Delivered" && canReview(viewingOrder._id) && (
                    <Button className="flex-1 gap-2"
                      onClick={() => { setDetailsOpen(false); openReview(viewingOrder); }}>
                      <Star className="h-4 w-4" /> Review
                    </Button>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
