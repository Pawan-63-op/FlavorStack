"use client";

import { Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StarRating } from "@/components/StarRating";
import type { RestaurantRatingView } from "@/lib/api/adapters/reviewRating";

/**
 * Aggregate rating summary (Phase 9, Batch 9.3): average score, total review
 * count, and a 5★→1★ distribution bar chart, fed by the rating adapter's
 * pre-computed per-star percentages. Renders a zero-state when a restaurant has
 * no (approved) reviews yet.
 */
export function RatingSummary({ rating }: { rating: RestaurantRatingView | undefined }) {
  const avgRating = rating?.avgRating ?? 0;
  const reviewCount = rating?.reviewCount ?? 0;

  if (reviewCount === 0) {
    return (
      <Card className="border-2 shadow-md">
        <CardContent className="pt-6 flex items-center gap-3 text-muted-foreground">
          <Star className="h-5 w-5" />
          <span>No ratings yet — be the first to review this restaurant.</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 shadow-md">
      <CardContent className="pt-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex flex-col items-center gap-1 sm:w-40">
            <span className="text-4xl font-bold">{avgRating.toFixed(1)}</span>
            <StarRating rating={Math.round(avgRating)} readonly size="sm" />
            <span className="text-sm text-muted-foreground">
              {reviewCount} review{reviewCount !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex-1 space-y-1.5">
            {rating?.distribution.map((bar) => (
              <div key={bar.star} className="flex items-center gap-3 text-sm">
                <span className="w-10 shrink-0 text-muted-foreground">{bar.star}★</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-yellow-400"
                    style={{ width: `${bar.percentage}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-muted-foreground">{bar.count}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
