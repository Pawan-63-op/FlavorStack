"use client";

import { Calendar, Truck, UtensilsCrossed } from "lucide-react";
import { motion } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StarRating } from "@/components/StarRating";
import type { ModerationStatus, ReviewView } from "@/lib/api/adapters/review";

/**
 * Single review card (Phase 9, Batch 9.3). Renders the dual rating (restaurant
 * always, delivery only when the customer left one), the comment, a generic
 * author label (server_2 carries no name/avatar), and — in the author's own
 * "My reviews" context (`showStatus`) — a moderation status badge.
 */

const MODERATION_BADGE_CLASSNAMES: Record<ModerationStatus, string> = {
  PENDING: "border-amber-300 text-amber-700",
  AUTO_FLAGGED: "border-amber-300 text-amber-700",
  APPROVED: "border-green-300 text-green-700",
  REJECTED: "border-red-300 text-red-700",
};

/** Outline-badge colour classes for a moderation status. Pure — exported for testing. */
export function moderationBadgeClassName(status: ModerationStatus): string {
  return MODERATION_BADGE_CLASSNAMES[status] ?? "border-border text-muted-foreground";
}

interface ReviewCardProps {
  review: ReviewView;
  /** Show the moderation status badge — used in the author's own "My reviews". */
  showStatus?: boolean;
}

export function ReviewCard({ review, showStatus = false }: ReviewCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-2 shadow-md hover:shadow-lg transition-shadow">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarFallback>{review.authorLabel.charAt(0)}</AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-3">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h4 className="font-semibold">{review.authorLabel}</h4>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {review.formattedDate}
                  </span>
                </div>
                {showStatus && (
                  <Badge variant="outline" className={moderationBadgeClassName(review.moderationStatus)}>
                    {review.moderationStatusLabel}
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Restaurant</span>
                  <StarRating rating={review.restaurantRating} readonly size="sm" />
                </div>
                {review.deliveryRating !== null && (
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Delivery</span>
                    <StarRating rating={review.deliveryRating} readonly size="sm" />
                  </div>
                )}
              </div>

              {review.comment && (
                <p className="text-muted-foreground leading-relaxed text-sm">{review.comment}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
