"use client";
import { useState } from "react";
import { Calendar, Truck, UtensilsCrossed } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/StarRating";
import { moderationBadgeClassName } from "@/components/reviews/ReviewCard";
import type { ReviewView } from "@/lib/api/adapters/review";

/**
 * Builds the optional `reason` for an approve/reject call — trimmed, omitted
 * when blank. Mirrors `AvailabilityToggle.buildAvailabilityInput` (Batch
 * 10.0 §2): the server bounds it to 1–500 chars, mirrored client-side via the
 * textarea's `maxLength`.
 */
export function buildModerationReasonInput(reason: string): string | undefined {
  const trimmed = reason.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Whether a rejection can be submitted. The server (domain `Review.reject` →
 * `Guard.againstEmptyString`) **requires** a non-empty reason — unlike approve,
 * whose reason is optional. Gate "Confirm reject" on this so the UI never POSTs
 * an empty reason and gets a 422 that strands the review in PENDING.
 */
export function canSubmitRejection(reason: string): boolean {
  return buildModerationReasonInput(reason) !== undefined;
}

interface ReviewModerationRowProps {
  review: ReviewView;
  onApprove: (reason?: string) => void;
  onReject: (reason?: string) => void;
  isApproving?: boolean;
  isRejecting?: boolean;
}

export function ReviewModerationRow({
  review,
  onApprove,
  onReject,
  isApproving = false,
  isRejecting = false,
}: ReviewModerationRowProps) {
  const [reason, setReason] = useState("");
  const [showReason, setShowReason] = useState(false);
  const isBusy = isApproving || isRejecting;

  return (
    <Card className="border-2">
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="text-sm text-muted-foreground space-y-0.5">
            <p>
              Customer <span className="font-medium text-foreground">{review.customerId}</span>
            </p>
            <p>
              Fulfillment <span className="font-medium text-foreground">{review.fulfillmentId}</span>
            </p>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {review.formattedDate}
            </span>
          </div>
          <Badge variant="outline" className={moderationBadgeClassName(review.moderationStatus)}>
            {review.moderationStatusLabel}
          </Badge>
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

        <p className="text-sm text-muted-foreground leading-relaxed">
          {review.comment ?? "No comment"}
        </p>

        {showReason ? (
          <div className="space-y-2">
            <Textarea
              placeholder="Reason (required to reject, optional to approve)"
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isBusy}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={isBusy}
                onClick={() => onApprove(buildModerationReasonInput(reason))}
              >
                {isApproving ? "Approving…" : "Confirm approve"}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={isBusy || !canSubmitRejection(reason)}
                onClick={() => onReject(buildModerationReasonInput(reason))}
              >
                {isRejecting ? "Rejecting…" : "Confirm reject"}
              </Button>
              <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => setShowReason(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" disabled={isBusy} onClick={() => onApprove(undefined)}>
              {isApproving ? "Approving…" : "Approve"}
            </Button>
            {/* Reject requires a reason (server-enforced), so this opens the reason
                editor rather than submitting an empty rejection. */}
            <Button size="sm" variant="destructive" disabled={isBusy} onClick={() => setShowReason(true)}>
              {isRejecting ? "Rejecting…" : "Reject"}
            </Button>
            <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => setShowReason(true)}>
              Add reason…
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
