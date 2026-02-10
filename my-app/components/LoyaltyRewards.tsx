"use client";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Separator } from "./ui/separator";
import { motion } from "motion/react";
import { Trophy, Gift, Star, TrendingUp, Award, ArrowUp, Coins } from "lucide-react";
import { useLoyaltyStore } from "@/store/loyaltyStore";
import { useEffect } from "react";

export function LoyaltyRewards() {
  const fetchLoyaltyData = useLoyaltyStore((state) => state.fetchLoyaltyData);

  useEffect(() => {
    fetchLoyaltyData();
  }, []);

  const points = useLoyaltyStore((state) => state.points);
  const tier = useLoyaltyStore((state) => state.tier);
  const transactions = useLoyaltyStore((state) => state.transactions);
  const redeemPoints = useLoyaltyStore((state) => state.redeemPoints);
  const getPointsToNextTier = useLoyaltyStore((state) => state.getPointsToNextTier);
  const getNextTier = useLoyaltyStore((state) => state.getNextTier);
  const getTiers = useLoyaltyStore((state) => state.getTiers);

  const nextTier = getNextTier();
  const pointsToNext = getPointsToNextTier();
  const progressToNext = nextTier
    ? ((points - tier.minPoints) / (nextTier.minPoints - tier.minPoints)) * 100
    : 100;

  // ⬇ UI helper effects ⬇
  const shimmer =
    "relative overflow-hidden after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/10 after:to-transparent after:translate-x-[-100%] after:animate-shimmer";

  const glow = (hex: string) =>
    `shadow-[0_0_20px_4px_${hex.replace("#", "")}33]`;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8">
      {/* HEADER */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <Trophy className="h-8 w-8 text-yellow-500 drop-shadow" />
          <h1 className="text-3xl font-bold">Loyalty Rewards</h1>
        </div>
        <p className="text-muted-foreground">
          Earn points with every order and unlock premium benefits
        </p>
      </motion.div>

      {/* CURRENT STATUS CARD */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card
          className={`
            border-2 rounded-2xl overflow-hidden 
            bg-gradient-to-br ${tier.color} text-white shadow-xl relative
          `}
        >
          <CardContent className="pt-8 pb-6 space-y-6">

            {/* Floating Glow Effects */}
            <div className="absolute -top-8 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>

            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Award className="h-7 w-7 drop-shadow-lg" />
                  <h2 className="font-semibold text-2xl">{tier.name} Member</h2>
                </div>

                <div className="flex items-end gap-2">
                  <span className="text-5xl font-bold drop-shadow">{points.toLocaleString()}</span>
                  <span className="text-white/80 text-lg mb-1">pts</span>
                </div>
              </div>

              <Badge
                variant="secondary"
                className="bg-white/25 backdrop-blur-sm border-white/20 text-white shadow px-3 py-1"
              >
                <Star className="h-4 w-4 fill-white mr-1" />
                {tier.name}
              </Badge>
            </div>

            {/* Progress to Next Tier */}
            {nextTier && (
              <>
                <Separator className="bg-white/30" />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-white/90">
                    <span>Progress to {nextTier.name}</span>
                    <span>{pointsToNext} pts left</span>
                  </div>

                  <div className="relative">
                    <Progress
                      value={progressToNext}
                      className="h-3 bg-white/20 rounded-full overflow-hidden"
                    />
                    <div
                      className="absolute inset-y-0 left-0 bg-white/20 blur-xl pointer-events-none"
                      style={{ width: `${progressToNext}%` }}
                    ></div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* BENEFITS */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="border-2 shadow-md rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              Your Benefits
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tier.benefits.map((b, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-4 rounded-xl border bg-accent/40 hover:bg-accent transition-all ${shimmer}`}
                >
                  <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center">
                    <Star className="h-4 w-4 text-primary fill-primary" />
                  </div>
                  <span className="text-sm font-medium">{b}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ALL TIERS */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-2 shadow-md rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              All Tiers
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="space-y-6">
              {getTiers().map((t, idx) => (
                <div key={t.name}>
                  <div className="flex gap-4 items-start">
                    <div
                      className={`h-14 w-14 rounded-xl bg-gradient-to-br ${t.color} flex items-center justify-center shadow-lg`}
                    >
                      <Award className="h-7 w-7 text-white drop-shadow" />
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">{t.name}</h3>

                        {tier.name === t.name && (
                          <Badge variant="default" className="text-xs">
                            Current
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground">
                        {t.minPoints.toLocaleString()}+ points
                      </p>

                      <div className="mt-1 space-y-1">
                        {t.benefits.slice(0, 2).map((b, j) => (
                          <div key={j} className="flex items-center gap-2 text-sm">
                            <span className="h-1.5 w-1.5 bg-primary rounded-full"></span>
                            {b}
                          </div>
                        ))}

                        {t.benefits.length > 2 && (
                          <div className="text-xs text-primary">
                            +{t.benefits.length - 2} more benefits
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {idx < getTiers().length - 1 && (
                    <Separator className="my-4" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* TRANSACTION HISTORY */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="border-2 shadow-md rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" />
              Points History
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              {transactions.slice(0, 5).map((t) => (
                <div
                  key={t.timestamp}
                  className="flex items-center justify-between p-4 rounded-xl bg-accent hover:bg-accent/70 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`
                        h-12 w-12 rounded-full flex items-center justify-center 
                        ${
                          t.type === "earned"
                            ? "bg-green-500/15 text-green-500"
                            : "bg-red-500/15 text-red-500"
                        }
                      `}
                    >
                      {t.type === "earned" ? (
                        <ArrowUp className="h-5 w-5" />
                      ) : (
                        <Gift className="h-5 w-5" />
                      )}
                    </div>

                    <div>
                      <p className="font-medium">{t.description}</p>
                      <span className="text-xs text-muted-foreground">{t.date}</span>
                    </div>
                  </div>

                  <div
                    className={`font-semibold ${
                      t.type === "earned" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {t.type === "earned" ? "+" : "-"}
                    {t.points}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
