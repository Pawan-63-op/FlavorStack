"use client";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
// import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Package, Clock, CheckCircle, XCircle, ChefHat, Truck, Star, Eye, RotateCcw, MapPin } from "lucide-react";
// import { useCart } from "@/context/CartContext";
// import { useReviews } from "@/context/ReviewContext";
// import { useCartStore } from "../store/cartStore";
import { useCartStore } from "@/admin_new/src/store/cartStore";
import { useReviewStore } from "../store/reviewStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { useState } from "react";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { StarRating } from "./StarRating";
import { toast } from "sonner";
import { ScrollArea } from "./ui/scroll-area";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
interface OrderHistoryProps {
  onNavigate?: (page: string, data?: any) => void;
}

export function OrderHistory({ onNavigate }: OrderHistoryProps = {}) {
  // const navigate = useNavigate();
  const router = useRouter();
// OLD
// const { orders, addToCart } = useCart();
// const { canReview, addReview } = useReviews();

// NEW
const fetchOrders = useCartStore((state) => state.fetchOrders);

useEffect(() => {
  console.log("📌 OrderHistory mounted → calling fetchOrders()");
  fetchOrders();
}, []);
const orders = useCartStore((state) => state.orders);
const addToCart = useCartStore((state) => state.addToCart);
const canReview = useReviewStore((state) => state.canReview);
const addReview = useReviewStore((state) => state.addReview);
const [reviewName, setReviewName] = useState("");
const [reviewEmail, setReviewEmail] = useState("");

  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewingOrder, setReviewingOrder] = useState<typeof orders[0] | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [viewingOrder, setViewingOrder] = useState<typeof orders[0] | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  const latestOrder = orders[0];
  const pastOrders = orders.slice(1);

  // const handleSubmitReview = () => {
  //   if (!reviewingOrder) return;
  //   if (reviewRating === 0) {
  //     toast.error("Please select a rating");
  //     return;
  //   }
  //   if (!reviewComment.trim()) {
  //     toast.error("Please write a review");
  //     return;
  //   }

  //   addReview({
  //     restaurantId: 1, // In real app, get from order
  //     restaurantName: String(reviewingOrder.restaurantName),
  //     rating: reviewRating,
  //     comment: reviewComment,
  //     orderId: String(reviewingOrder._id),
  //     photos: []
  //   });

  //   toast.success("Review submitted successfully!");
  //   setReviewDialogOpen(false);
  //   setReviewingOrder(null);
  //   setReviewRating(0);
  //   setReviewComment("");
  // };
const handleSubmitReview = async () => {
  if (!reviewingOrder) return;

  if (!reviewName.trim()) {
    toast.error("Please enter your name");
    return;
  }
  if (!reviewEmail.trim()) {
    toast.error("Please enter your email");
    return;
  }
  if (reviewRating === 0) {
    toast.error("Please select a rating");
    return;
  }
  if (!reviewComment.trim()) {
    toast.error("Please write a review");
    return;
  }

  try {
    const response = await fetch("http://localhost:8000/api/reviews", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        order: reviewingOrder.orderId || reviewingOrder._id, // send string ID
        restaurant: reviewingOrder.restaurant,
        rating: reviewRating,
        comment: reviewComment,
        name: reviewName,
        email: reviewEmail,
        photos: []
      })
    });

    const data = await response.json();
toast.success("Submitted review data:", data);
console.log("Submitted review response:", response, data);
    if (!response.ok) {
      console.log("error here");
      toast.error(data.message || "Failed to submit review");
      return;
    }

    toast.success("Review submitted successfully!");

    // cleanup
    setReviewDialogOpen(false);
    setReviewingOrder(null);
    setReviewRating(0);
    setReviewComment("");
    setReviewName("");
    setReviewEmail("");
  } catch (error) {
    toast.error("Something went wrong");
  }
};

  const handleReorder = (order: typeof orders[0]) => {
    order.items.forEach(item => {
      addToCart({
        id: item.id,
        restaurantId:item.restaurantId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        restaurantName: String(order.restaurantName),
        image: ""
      });
    });
    toast.success("Items added to cart!");
    // if (onNavigate) {
    //   onNavigate("restaurant", { id: 1 }); // Navigate to restaurant
    // }
    router.push(`/restaurants`);  // navigate to restaurant page
  };

  const handleViewDetails = (order: typeof orders[0]) => {
    setViewingOrder(order);
    setDetailsDialogOpen(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "confirmed":
        return <CheckCircle className="h-4 w-4" />;
      case "preparing":
        return <ChefHat className="h-4 w-4" />;
      case "Delivered":
        return <Truck className="h-4 w-4" />;
      case "cancelled":
        return <XCircle className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500";
      case "confirmed":
        return "bg-blue-500";
      case "preparing":
        return "bg-purple-500";
      case "Delivered":
        return "bg-green-500";
      case "cancelled":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    

    <div className="w-full max-w-6xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="mb-2">My Orders</h2>
        <p className="text-muted-foreground">Track your current and past orders</p>
      </motion.div>

      <Tabs defaultValue="latest" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="latest">Latest Order</TabsTrigger>
          <TabsTrigger value="history">Order History</TabsTrigger>
        </TabsList>

        <TabsContent value="latest" className="space-y-6 mt-6">
          {latestOrder ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="border-2 shadow-lg">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        Order #{latestOrder.orderId}
                        <Badge className={`${getStatusColor(latestOrder.status)} border-0`}>
                          {latestOrder.status.charAt(0).toUpperCase() + latestOrder.status.slice(1)}
                        </Badge>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {latestOrder.restaurantName} • {latestOrder.date}
                      </p>
                    </div>
                    <p className="text-xl">${latestOrder.total.toFixed(2)}</p>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Order Status Timeline */}
                  <div className="space-y-4">
                    <h4>Order Status</h4>
                    <div className="space-y-3">
                      {["pending", "confirmed", "preparing", "Delivered"].map((status, index) => {
                        const isActive = ["pending", "confirmed", "preparing", "Delivered"].indexOf(latestOrder.status) >= index;
                        const isCurrent = latestOrder.status === status;
                        
                        return (
                          <div key={status} className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${isActive ? getStatusColor(status) : "bg-muted"} text-white`}>
                              {getStatusIcon(status)}
                            </div>
                            <div className="flex-1">
                              <p className={isCurrent ? "" : "text-muted-foreground"}>
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                              </p>
                            </div>
                            {isCurrent && (
                              <Badge variant="secondary">Current</Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  {/* Order Items */}
                  <div className="space-y-3">
                    <h4>Order Items</h4>
                    {latestOrder.items.map((item, index) => (
                      <div key={index} className="flex justify-between items-center py-2">
                        <div>
                          <p>{item.name}</p>
                          <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                        </div>
                        <p>${(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* Order Total */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>${latestOrder.total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Delivery Fee</span>
                      <span>$2.99</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span>Total</span>
                      <span className="text-xl">${(latestOrder.total + 2.99).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline" 
                      className="gap-2"
                      onClick={() => handleViewDetails(latestOrder)}
                    >
                      <Eye className="h-4 w-4" />
                      View Details
                    </Button>
                    <Button 
                      variant="outline" 
                      className="gap-2"
                      onClick={() => handleReorder(latestOrder)}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Reorder
                    </Button>
                    {latestOrder.status === "Delivered" && canReview(latestOrder._id) && (
                      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
                        <DialogTrigger asChild>
                          <Button 
                            className="col-span-2 gap-2"
                            onClick={() => setReviewingOrder(latestOrder)}
    //                        onClick={() =>
    // navigate(`/feedback/${latestOrder._id}`, {
    //   state: { orderId: latestOrder._id }
    // })
  // }
                          >
                            <Star className="h-4 w-4" />
                            Leave Review
                          </Button>
                        </DialogTrigger>
                        {/* <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Review {reviewingOrder?.restaurantName}</DialogTitle>
                            <DialogDescription>
                              Share your experience with this order
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Rating *</Label>
                              <StarRating
                                rating={reviewRating}
                                onRatingChange={setReviewRating}
                                size="lg"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Your Review *</Label>
                              <Textarea
                                placeholder="Tell us about your experience..."
                                value={reviewComment}
                                onChange={(e) => setReviewComment(e.target.value)}
                                rows={4}
                              />
                            </div>
                            <Button onClick={handleSubmitReview} className="w-full">
                              Submit Review
                            </Button>
                          </div>
                        </DialogContent> */}
<DialogContent>
  <DialogHeader>
    <DialogTitle>Review {reviewingOrder?.restaurantName}</DialogTitle>
    <DialogDescription>Share your experience with this order</DialogDescription>
  </DialogHeader>

  <div className="space-y-4 py-4">
    {/* Name */}
    <div className="space-y-2">
      <Label>Your Name *</Label>
      <Input
        placeholder="Enter your name"
        value={reviewName}
        onChange={(e) => setReviewName(e.target.value)}
      />
    </div>

    {/* Email */}
    <div className="space-y-2">
      <Label>Your Email *</Label>
      <Input
        type="email"
        placeholder="Enter your email"
        value={reviewEmail}
        onChange={(e) => setReviewEmail(e.target.value)}
      />
    </div>

    {/* Rating */}
    <div className="space-y-2">
      <Label>Rating *</Label>
      <StarRating
        rating={reviewRating}
        onRatingChange={setReviewRating}
        size="lg"
      />
    </div>

    {/* Comment */}
    <div className="space-y-2">
      <Label>Review *</Label>
      <Textarea
        placeholder="Tell us about your experience..."
        value={reviewComment}
        onChange={(e) => setReviewComment(e.target.value)}
        rows={4}
      />
    </div>

    <Button onClick={handleSubmitReview} className="w-full">
      Submit Review
    </Button>
  </div>
</DialogContent>

                      </Dialog>
                    )}
                  </div>
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

        <TabsContent value="history" className="space-y-4 mt-6">
          {pastOrders.length > 0 ? (
            pastOrders.map((order, index) => (
              <motion.div
                key={order._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="border-2 shadow-md hover:shadow-lg transition-all">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4>Order #{order.orderId}</h4>
                          <Badge className={`${getStatusColor(order.status)} border-0`}>
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {order.restaurantName} • {order.date}
                        </p>
                      </div>
                      <p className="text-xl">${order.total.toFixed(2)}</p>
                    </div>

                    <div className="space-y-2">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {item.quantity}x {item.name}
                          </span>
                          <span>${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    <Separator className="my-4" />

                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        variant="outline" 
                        className="gap-2"
                        onClick={() => handleViewDetails(order)}
                      >
                        <Eye className="h-4 w-4" />
                        Details
                      </Button>
                      <Button 
                        variant="outline" 
                        className="gap-2"
                        onClick={() => handleReorder(order)}
                      >
                        <RotateCcw className="h-4 w-4" />
                        Reorder
                      </Button>
                      {order.status === "Delivered" && canReview(order._id) ? (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="default" 
                              className="col-span-2 gap-2"
                              onClick={() => setReviewingOrder(order)}
  //                             onClick={() =>
  //   navigate(`/feedback/${latestOrder._id}`, {
  //     state: { orderId: latestOrder._id }
  //   })
  // }
                            >
                              <Star className="h-4 w-4" />
                              Leave Review
                            </Button>
                          </DialogTrigger>
                          {/* <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Review {order.restaurantName}</DialogTitle>
                              <DialogDescription>
                                Share your experience with this order
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label>Rating *</Label>
                                <StarRating
                                  rating={reviewRating}
                                  onRatingChange={setReviewRating}
                                  size="lg"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Your Review *</Label>
                                <Textarea
                                  placeholder="Tell us about your experience..."
                                  value={reviewComment}
                                  onChange={(e) => setReviewComment(e.target.value)}
                                  rows={4}
                                />
                              </div>
                              <Button onClick={handleSubmitReview} className="w-full">
                                Submit Review
                              </Button>
                            </div>
                          </DialogContent> */}
                          <DialogContent>
  <DialogHeader>
    <DialogTitle>Review {reviewingOrder?.restaurantName}</DialogTitle>
    <DialogDescription>Share your experience with this order</DialogDescription>
  </DialogHeader>

  <div className="space-y-4 py-4">
    {/* Name */}
    <div className="space-y-2">
      <Label>Your Name *</Label>
      <Input
        placeholder="Enter your name"
        value={reviewName}
        onChange={(e) => setReviewName(e.target.value)}
      />
    </div>

    {/* Email */}
    <div className="space-y-2">
      <Label>Your Email *</Label>
      <Input
        type="email"
        placeholder="Enter your email"
        value={reviewEmail}
        onChange={(e) => setReviewEmail(e.target.value)}
      />
    </div>

    {/* Rating */}
    <div className="space-y-2">
      <Label>Rating *</Label>
      <StarRating
        rating={reviewRating}
        onRatingChange={setReviewRating}
        size="lg"
      />
    </div>

    {/* Comment */}
    <div className="space-y-2">
      <Label>Review *</Label>
      <Textarea
        placeholder="Tell us about your experience..."
        value={reviewComment}
        onChange={(e) => setReviewComment(e.target.value)}
        rows={4}
      />
    </div>

    <Button onClick={handleSubmitReview} className="w-full">
      Submit Review
    </Button>
  </div>
</DialogContent>

                        </Dialog>
                      ) : null}
                    </div>
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

      {/* Order Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>Order #{viewingOrder?.orderId}</DialogDescription>
          </DialogHeader>
          {viewingOrder && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-6 pr-4">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge
                    variant={
                      viewingOrder.status === "Delivered"
                        ? "default"
                        : viewingOrder.status === "cancelled"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {viewingOrder.status}
                  </Badge>
                </div>

                <Separator />

                {/* Restaurant */}
                <div>
                  <h4 className="mb-2">Restaurant</h4>
                  <div className="flex items-center gap-2">
                    <ChefHat className="h-4 w-4 text-muted-foreground" />
                    <span>{viewingOrder.restaurantName}</span>
                  </div>
                </div>

                <Separator />

                {/* Items */}
                <div>
                  <h4 className="mb-3">Order Items</h4>
                  <div className="space-y-3">
                    {viewingOrder.items.map((item, index) => (
                      <div key={index} className="flex items-start justify-between p-3 bg-accent rounded-lg">
                        <div className="flex-1">
                          <p>{item.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Quantity: {item.quantity}
                          </p>
                        </div>
                        <span>${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Pricing */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${viewingOrder.total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivery Fee</span>
                    <span>$2.99</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span>${(viewingOrder.total * 0.08).toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span>Total</span>
                    <span className="text-xl">${(viewingOrder.total + 2.99 + viewingOrder.total * 0.08).toFixed(2)}</span>
                  </div>
                </div>

                <Separator />

                {/* Order Info */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order Date</span>
                    <span>{viewingOrder.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order ID</span>
                    <span className="font-mono">{viewingOrder._id}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4">
                  <Button 
                    variant="outline" 
                    className="flex-1 gap-2"
                    onClick={() => handleReorder(viewingOrder)}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reorder
                  </Button>
                  {viewingOrder.status === "Delivered" && canReview(viewingOrder.id) && (
                    <Button 
                      className="flex-1 gap-2"
                      onClick={() => {
                        setDetailsDialogOpen(false);
                        setReviewingOrder(viewingOrder);
                        setReviewDialogOpen(true);
                      }}
                    >
                      <Star className="h-4 w-4" />
                      Review
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
