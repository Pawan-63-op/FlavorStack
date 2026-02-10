"use client";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle, Package, Truck, ChefHat, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";

interface OrderProcessingProps {
  orderId: string;
  restaurantName: string;
  total: number;
  pointsEarned?: number;
  onComplete: () => void;
}

export function OrderProcessing({ 
  orderId, 
  restaurantName, 
  total, 
  pointsEarned = 0,
  onComplete 
}: OrderProcessingProps) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  const steps = [
    { icon: CheckCircle, label: "Order Confirmed", color: "text-green-500", bg: "bg-green-500" },
    { icon: ChefHat, label: "Preparing Food", color: "text-orange-500", bg: "bg-orange-500" },
    { icon: Package, label: "Ready for Pickup", color: "text-blue-500", bg: "bg-blue-500" },
    { icon: Truck, label: "Out for Delivery", color: "text-purple-500", bg: "bg-purple-500" }
  ];

  useEffect(() => {
    // Show confetti after initial render
    setTimeout(() => setShowConfetti(true), 300);

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          // Wait a bit before completing
          setTimeout(() => onComplete(), 1000);
          return 100;
        }
        return prev + 1.5; // Slower progress for better UX
      });
    }, 80);

    return () => clearInterval(timer);
  }, [onComplete]);

  useEffect(() => {
    const stepProgress = Math.floor(progress / 25);
    setCurrentStep(Math.min(stepProgress, steps.length - 1));
  }, [progress, steps.length]);

  return (
    <div className="w-full max-w-2xl mx-auto min-h-[60vh] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full"
      >
        <Card className="border-2 shadow-2xl overflow-hidden">
          <CardContent className="pt-12 pb-12">
            <div className="space-y-8">
              {/* Success Icon with Animation */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", bounce: 0.5 }}
                className="flex justify-center relative"
              >
                <div className="h-24 w-24 rounded-full bg-green-500/20 flex items-center justify-center relative">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.4 }}
                    className="h-20 w-20 rounded-full bg-green-500/30 flex items-center justify-center"
                  >
                    <CheckCircle className="h-12 w-12 text-green-500" />
                  </motion.div>
                  
                  {/* Animated rings */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 2, opacity: 0 }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute inset-0 rounded-full border-2 border-green-500"
                  />
                </div>
              </motion.div>

              {/* Order Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-center space-y-3"
              >
                <h2 className="text-2xl">Order Placed Successfully!</h2>
                <p className="text-muted-foreground">Order #{orderId.slice(0, 8).toUpperCase()}</p>
                <Badge variant="secondary" className="text-lg px-6 py-2">
                  ${total.toFixed(2)}
                </Badge>
              </motion.div>

              {/* Restaurant */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-center"
              >
                <p className="text-sm text-muted-foreground">from</p>
                <h3 className="text-xl font-semibold">{restaurantName}</h3>
              </motion.div>

              {/* Loyalty Points */}
              {pointsEarned > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 }}
                  className="flex items-center justify-center gap-2 p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-lg border-2 border-amber-500/20"
                >
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  <p className="text-sm font-medium">
                    You earned <span className="text-amber-600 font-bold text-lg">{pointsEarned}</span> loyalty points!
                  </p>
                  <Sparkles className="h-5 w-5 text-amber-500" />
                </motion.div>
              )}

              {/* Progress Bar */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="space-y-3"
              >
                <Progress value={progress} className="h-3" />
                <p className="text-center text-sm text-muted-foreground">
                  {progress < 100 ? "Processing your order..." : "Order confirmed! Redirecting..."}
                </p>
              </motion.div>

              {/* Steps */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="grid grid-cols-4 gap-4"
              >
                {steps.map((step, index) => {
                  const Icon = step.icon;
                  const isActive = index <= currentStep;
                  const isCompleted = index < currentStep;

                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 + index * 0.1 }}
                      className="flex flex-col items-center gap-2"
                    >
                      <motion.div
                        animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                        transition={{ duration: 0.3 }}
                        className={`h-14 w-14 rounded-full border-2 flex items-center justify-center transition-all ${
                          isActive
                            ? `${step.color} border-current ${step.bg}/10`
                            : "border-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="h-7 w-7" />
                      </motion.div>
                      <p className={`text-xs text-center font-medium ${
                        isActive ? step.color : "text-muted-foreground"
                      }`}>
                        {step.label}
                      </p>
                      {isActive && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="h-1.5 w-1.5 rounded-full bg-current"
                        />
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>

              {/* Message */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="text-center p-5 bg-accent/50 rounded-lg border"
              >
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your order is being prepared with care. The restaurant will start preparing your food shortly. 
                  You can track your order status in real-time!
                </p>
              </motion.div>

              {/* Action hint */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="text-center"
              >
                <p className="text-xs text-muted-foreground">
                  Redirecting you to track your order...
                </p>
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}