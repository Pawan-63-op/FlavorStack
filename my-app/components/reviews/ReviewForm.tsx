"use client";

import { useState } from "react";
import { CheckCircle2, Clock, Send } from "lucide-react";
import { motion } from "motion/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/StarRating";
import { ApiError } from "@/lib/api/errors/ApiError";
import { useSubmitReview } from "@/lib/api/hooks/useReviews";

/**
 * Dual-rating review submission form (Phase 9, Batch 9.2). Replaces the legacy
 * single-rating `FeedbackForm`: restaurant rating is required, delivery rating
 * is optional/clearable, comment is optional and bounded. Verified-purchase
 * gating + `fulfillmentId` resolution live in the page (`feedback/[orderId]`);
 * this form just submits against an already-resolved delivered fulfillment via
 * `useSubmitReview`.
 *
 * Client validation mirrors the server zod bounds
 * (`server_2 submitReviewSchema`): restaurantRating int 1–5 (required),
 * deliveryRating int 1–5 | null (optional), comment ≤1000 chars. Server-side
 * verified-purchase errors are mapped to friendly copy via `reviewErrorMessage`.
 */

/** Max comment length — mirrors `submitReviewSchema` (`comment` ≤1000). */
export const COMMENT_MAX_LENGTH = 1000;

export interface ReviewFormValues {
  restaurantRating: number;
  deliveryRating: number | null;
  comment: string;
}

export interface ReviewFormValidation {
  valid: boolean;
  restaurantRatingError: string | null;
  deliveryRatingError: string | null;
  commentError: string | null;
}

/** True for an integer in the inclusive 1–5 star range. */
function isValidStar(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

/**
 * Pure client-side validation mirroring the server's zod bounds. Restaurant
 * rating is required (1–5); delivery rating is optional but, when present, must
 * also be 1–5; comment must be ≤{@link COMMENT_MAX_LENGTH}. Exported for unit
 * testing without rendering.
 */
export function validateReviewForm(values: ReviewFormValues): ReviewFormValidation {
  const restaurantRatingError = isValidStar(values.restaurantRating)
    ? null
    : "Please rate the restaurant from 1 to 5 stars.";

  const deliveryRatingError =
    values.deliveryRating === null || isValidStar(values.deliveryRating)
      ? null
      : "Delivery rating must be from 1 to 5 stars.";

  const commentError =
    values.comment.length > COMMENT_MAX_LENGTH
      ? `Comment must be ${COMMENT_MAX_LENGTH} characters or fewer.`
      : null;

  return {
    valid: restaurantRatingError === null && deliveryRatingError === null && commentError === null,
    restaurantRatingError,
    deliveryRatingError,
    commentError,
  };
}

/**
 * Friendly copy keyed by the server's domain reason token. server_2 throws
 * these as `ValidationError`/`ForbiddenError`/`ConflictError`, so the umbrella
 * `ApiError.code` is `VALIDATION_ERROR`/`FORBIDDEN`/`CONFLICT` and the specific
 * reason lands in `ApiError.message` (verified against the engagement
 * `SubmitReview` use-case + the server error handler).
 */
const REVIEW_ERROR_MESSAGES: Record<string, string> = {
  review_already_submitted: "You've already reviewed this order.",
  review_not_eligible: "Reviews open after your order has been delivered.",
  review_not_owned: "We couldn't verify this order belongs to you.",
  review_restaurant_mismatch: "We couldn't verify this order belongs to you.",
};

const GENERIC_REVIEW_ERROR = "Something went wrong submitting your review. Please try again.";

/**
 * Map a submission failure to user-facing copy. Recognised server reasons
 * (`review_already_submitted` 409, `review_not_eligible` 422,
 * `review_not_owned` 403, `review_restaurant_mismatch` 422) get distinct
 * messages; anything else falls back to a generic message. The reason token is
 * carried in `ApiError.message` (the code is the broad category). Pure —
 * exported for unit testing.
 */
export function reviewErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.message in REVIEW_ERROR_MESSAGES) {
    return REVIEW_ERROR_MESSAGES[error.message];
  }
  return GENERIC_REVIEW_ERROR;
}

interface ReviewFormProps {
  restaurantId: string;
  fulfillmentId: string;
}

export function ReviewForm({ restaurantId, fulfillmentId }: ReviewFormProps) {
  const [restaurantRating, setRestaurantRating] = useState(0);
  const [deliveryRating, setDeliveryRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const submit = useSubmitReview();

  const validation = validateReviewForm({ restaurantRating, deliveryRating, comment });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!validation.valid) return;

    const trimmed = comment.trim();
    submit.mutate(
      {
        restaurantId,
        fulfillmentId,
        restaurantRating,
        deliveryRating: deliveryRating ?? undefined,
        comment: trimmed.length > 0 ? trimmed : undefined,
      },
      { onError: (err) => setErrorMessage(reviewErrorMessage(err)) },
    );
  };

  // Success → the review was accepted but is PENDING moderation; it is not yet
  // publicly visible (appears under "My reviews" with a pending badge).
  if (submit.isSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="w-full max-w-2xl mx-auto border-2 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              Thanks for your review!
            </CardTitle>
            <CardDescription>
              Your review has been submitted and is now pending moderation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
              <Clock className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                It won&apos;t appear on the restaurant page until it&apos;s approved, but you can
                find it under <span className="font-medium">My reviews</span> with its status.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const commentTooLong = validation.commentError !== null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="w-full max-w-2xl mx-auto border-2 shadow-lg">
        <CardHeader>
          <CardTitle>Rate your order</CardTitle>
          <CardDescription>
            Share how the restaurant and delivery were. Only the restaurant rating is required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Restaurant rating (required) */}
            <div className="space-y-3">
              <Label>Restaurant rating *</Label>
              <StarRating rating={restaurantRating} onRatingChange={setRestaurantRating} size="lg" />
            </div>

            {/* Delivery rating (optional / clearable) */}
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <Label>Delivery rating (optional)</Label>
                {deliveryRating !== null && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline"
                    onClick={() => setDeliveryRating(null)}
                  >
                    Clear
                  </button>
                )}
              </div>
              <StarRating
                rating={deliveryRating ?? 0}
                onRatingChange={setDeliveryRating}
                size="lg"
              />
            </div>

            {/* Comment (optional, bounded) */}
            <div className="space-y-2">
              <Label htmlFor="comment">Comment (optional)</Label>
              <Textarea
                id="comment"
                placeholder="Tell us about your experience…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={5}
              />
              <p
                className={`text-right text-xs ${
                  commentTooLong ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {comment.length}/{COMMENT_MAX_LENGTH}
              </p>
            </div>

            {errorMessage && (
              <p role="alert" className="text-sm text-destructive">
                {errorMessage}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={!validation.valid || submit.isPending}
            >
              <Send className="mr-2 h-4 w-4" />
              {submit.isPending ? "Submitting…" : "Submit review"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
