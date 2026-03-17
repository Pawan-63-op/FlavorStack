"use client";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Separator } from "./ui/separator";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle, ChefHat, Truck, Package,
  Sparkles, MapPin, Phone, User, Clock,
  RefreshCw, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// ── Status config ─────────────────────────────────────────────────────────────
const STEPS = [
  { key: "pending",             label: "Order Confirmed",      icon: CheckCircle, color: "text-green-500",  bg: "bg-green-500",  ring: "ring-green-500" },
  { key: "confirmed",           label: "Confirmed",            icon: CheckCircle, color: "text-blue-500",   bg: "bg-blue-500",   ring: "ring-blue-500" },
  { key: "preparing",           label: "Preparing Food",       icon: ChefHat,     color: "text-orange-500", bg: "bg-orange-500", ring: "ring-orange-500" },
  { key: "out-for-delivery",    label: "Out for Delivery",     icon: Truck,       color: "text-purple-500", bg: "bg-purple-500", ring: "ring-purple-500" },
  { key: "Delivered",           label: "Delivered",            icon: Package,     color: "text-green-600",  bg: "bg-green-600",  ring: "ring-green-600" },
];

const STATUS_MESSAGES: Record<string, string> = {
  pending:           "Your order has been received and is awaiting confirmation.",
  confirmed:         "The restaurant confirmed your order! Preparing soon.",
  preparing:         "The kitchen is preparing your food right now.",
  "out-for-delivery":"Your order is on its way! Keep an eye out.",
  Delivered:         "Your order has been delivered. Enjoy your meal!",
  cancelled:         "This order has been cancelled.",
};

const STEP_KEYS = STEPS.map((s) => s.key);

function getStepIndex(status: string) {
  const idx = STEP_KEYS.indexOf(status);
  return idx === -1 ? 0 : idx;
}

function getProgress(status: string) {
  if (status === "cancelled") return 0;
  const idx = getStepIndex(status);
  return Math.round(((idx + 1) / STEPS.length) * 100);
}

// ── ETA helpers ───────────────────────────────────────────────────────────────

function parseDeliveryMinutes(str: string): number {
  // Handles "25-35 min", "30 min", "30-40 min"
  const nums = str?.match(/\d+/g);
  if (!nums) return 35;
  const values = nums.map(Number);
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function useCountdown(targetMs: number | null) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!targetMs) return;
    const tick = () => {
      const diff = targetMs - Date.now();
      setRemaining(diff > 0 ? diff : 0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  return remaining;
}

function formatCountdown(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  orderMongoId: string;   // MongoDB _id — used to poll
  orderId: string;        // display ID e.g. ORD-123
  restaurantName: string;
  total: number;
  pointsEarned?: number;
  deliveryTime?: string;  // e.g. "25-35 min" from restaurant
}

export function OrderTracking({
  orderMongoId,
  orderId,
  restaurantName,
  total,
  pointsEarned = 0,
  deliveryTime = "30-40 min",
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<string>("pending");
  const [deliveryAddress, setDeliveryAddress] = useState<{
    name: string; phone: string; address: string;
  } | null>(null);
  const [createdAt, setCreatedAt] = useState<number | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const prevStatusRef = useRef<string>("pending");
  const POLL_INTERVAL = 8000; // 8 seconds

  // ETA target — createdAt + avg delivery minutes
  const etaMs = createdAt
    ? createdAt + parseDeliveryMinutes(deliveryTime) * 60 * 1000
    : null;
  const countdown = useCountdown(
    status !== "Delivered" && status !== "cancelled" ? etaMs : null
  );

  // ── Polling ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!orderMongoId) return;

    const poll = async () => {
      try {
        const res = await fetch(
          `http://localhost:8000/api/orders/${orderMongoId}`,
          { credentials: "include" }
        );
        if (!res.ok) return;
        const data = await res.json();
        const order = data.order || data;

        const newStatus: string = order.status;

        // Fire toast when status changes
        if (prevStatusRef.current !== newStatus) {
          prevStatusRef.current = newStatus;
          if (newStatus === "confirmed") {
            toast.success("Order confirmed by restaurant!", { icon: "✅" });
          } else if (newStatus === "preparing") {
            toast.success("Kitchen started preparing your food!", { icon: "👨‍🍳" });
          } else if (newStatus === "out-for-delivery") {
            toast.success("Your order is on its way!", { icon: "🛵" });
          } else if (newStatus === "Delivered") {
            toast.success("Order delivered! Enjoy your meal!", { icon: "🎉" });
          } else if (newStatus === "cancelled") {
            toast.error("Your order was cancelled.");
          }
        }

        setStatus(newStatus);

        if (order.deliveryAddress) setDeliveryAddress(order.deliveryAddress);
        if (order.createdAt) setCreatedAt(new Date(order.createdAt).getTime());

        // Stop polling when terminal state
        if (["Delivered", "cancelled"].includes(newStatus)) {
          setIsPolling(false);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    poll(); // immediate first call
    if (!isPolling) return;
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [orderMongoId, isPolling]);

  const currentStepIdx = getStepIndex(status);
  const progress = getProgress(status);
  const isCancelled = status === "cancelled";
  const isDelivered = status === "Delivered";

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <Card className="border-2 shadow-2xl overflow-hidden">
          <CardContent className="pt-10 pb-10">
            <div className="space-y-8">

              {/* ── Success icon ── */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", bounce: 0.5 }}
                className="flex justify-center"
              >
                <div className={`h-24 w-24 rounded-full flex items-center justify-center relative ${
                  isCancelled ? "bg-red-500/20" : "bg-green-500/20"
                }`}>
                  <div className={`h-20 w-20 rounded-full flex items-center justify-center ${
                    isCancelled ? "bg-red-500/30" : "bg-green-500/30"
                  }`}>
                    {isCancelled
                      ? <XCircle className="h-12 w-12 text-red-500" />
                      : <CheckCircle className="h-12 w-12 text-green-500" />
                    }
                  </div>
                  {!isCancelled && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 2, opacity: 0 }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="absolute inset-0 rounded-full border-2 border-green-500"
                    />
                  )}
                </div>
              </motion.div>

              {/* ── Order info ── */}
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">
                  {isCancelled ? "Order Cancelled" : "Order Placed Successfully!"}
                </h2>
                <p className="text-muted-foreground font-mono text-sm">{orderId}</p>
                <Badge variant="secondary" className="text-lg px-6 py-1.5">
                  ${total.toFixed(2)}
                </Badge>
                <p className="text-sm text-muted-foreground">from {restaurantName}</p>
              </div>

              {/* ── Points earned ── */}
              {pointsEarned > 0 && !isCancelled && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
                  className="flex items-center justify-center gap-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20"
                >
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <p className="text-sm font-medium">
                    You earned{" "}
                    <span className="text-amber-600 font-bold">{pointsEarned}</span>{" "}
                    loyalty points!
                  </p>
                  <Sparkles className="h-4 w-4 text-amber-500" />
                </motion.div>
              )}

              {/* ── Status message ── */}
              <div className="text-center p-4 bg-accent/50 rounded-xl border">
                <p className="text-sm text-muted-foreground">
                  {STATUS_MESSAGES[status] || "Processing your order..."}
                </p>
              </div>

              {!isCancelled && (
                <>
                  {/* ── Progress bar ── */}
                  <div className="space-y-2">
                    <Progress value={progress} className="h-2.5" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Order placed</span>
                      <span>{progress}%</span>
                      <span>Delivered</span>
                    </div>
                  </div>

                  {/* ── Step indicators ── */}
                  <div className="grid grid-cols-5 gap-2">
                    {STEPS.map((step, index) => {
                      const Icon = step.icon;
                      const isActive = index <= currentStepIdx;
                      const isCurrent = index === currentStepIdx;

                      return (
                        <motion.div
                          key={step.key}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 + index * 0.08 }}
                          className="flex flex-col items-center gap-1.5"
                        >
                          <div className={`h-11 w-11 rounded-full border-2 flex items-center justify-center transition-all ${
                            isCurrent
                              ? `${step.color} border-current ${step.bg}/10 ring-2 ${step.ring} ring-offset-2`
                              : isActive
                              ? `${step.color} border-current ${step.bg}/10`
                              : "border-muted text-muted-foreground"
                          }`}>
                            {isActive
                              ? <Icon className="h-5 w-5" />
                              : <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                            }
                          </div>
                          <p className={`text-xs text-center leading-tight ${
                            isActive ? step.color : "text-muted-foreground"
                          }`}>
                            {step.label}
                          </p>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* ── ETA countdown ── */}
                  {countdown !== null && countdown > 0 && !isDelivered && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl"
                    >
                      <Clock className="h-5 w-5 text-primary" />
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Estimated arrival</p>
                        <p className="text-2xl font-bold text-primary font-mono">
                          {formatCountdown(countdown)}
                        </p>
                      </div>
                      <Clock className="h-5 w-5 text-primary" />
                    </motion.div>
                  )}
                </>
              )}

              {/* ── Delivery address ── */}
              {deliveryAddress && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Delivering to</p>
                    <div className="p-3 bg-accent rounded-xl space-y-1.5">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{deliveryAddress.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{deliveryAddress.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{deliveryAddress.address}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ── Polling indicator ── */}
              {isPolling && !isDelivered && !isCancelled && (
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>Tracking your order live...</span>
                </div>
              )}

              {/* ── Actions ── */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.push("/orders")}
                >
                  View All Orders
                </Button>
                {isDelivered && (
                  <Button
                    className="flex-1"
                    onClick={() => router.push(`/feedback/${orderMongoId}`)}
                  >
                    Leave Review
                  </Button>
                )}
                {!isDelivered && !isCancelled && (
                  <Button
                    className="flex-1"
                    onClick={() => router.push("/restaurants")}
                  >
                    Order More
                  </Button>
                )}
              </div>

            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
