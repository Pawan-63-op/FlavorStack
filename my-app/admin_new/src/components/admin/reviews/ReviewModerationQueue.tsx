"use client";
import { useState } from "react";
import { MessageSquareWarning } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError } from "@/lib/api/errors/ApiError";
import type { ModerationStatus } from "@/lib/api/adapters/review";
import { useAdminReviews, useApproveReview, useRejectReview } from "@/lib/api/hooks/useReviewModeration";
import { ReviewModerationRow } from "./ReviewModerationRow";

/**
 * Status filter options for the moderation queue (Phase 11, Batch 11.1).
 * `PENDING` first/default — matches the server's own default when `status`
 * is omitted from `GET /admin/reviews`.
 */
export const MODERATION_STATUS_FILTERS: ModerationStatus[] = [
  "PENDING",
  "AUTO_FLAGGED",
  "APPROVED",
  "REJECTED",
];

const EMPTY_STATE_MESSAGES: Record<ModerationStatus, string> = {
  PENDING: "No pending reviews.",
  AUTO_FLAGGED: "No auto-flagged reviews.",
  APPROVED: "No approved reviews.",
  REJECTED: "No rejected reviews.",
};

/** Empty-state copy for the current status filter. Pure — exported for testing. */
export function moderationEmptyStateMessage(status: ModerationStatus): string {
  return EMPTY_STATE_MESSAGES[status] ?? "No reviews for this filter.";
}

/** Friendly message for moderation action errors — a 404 most likely means another moderator already acted on this review. */
export function moderationErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return "This review was already handled by someone else.";
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

export function ReviewModerationQueue() {
  const [status, setStatus] = useState<ModerationStatus>("PENDING");
  const query = useAdminReviews({ status });
  const approveReview = useApproveReview();
  const rejectReview = useRejectReview();

  const reviews = query.data?.pages.flatMap((page) => page.items) ?? [];

  const handleApprove = (id: string, reason?: string) => {
    approveReview.mutate(
      { id, reason },
      {
        onSuccess: () => toast.success("Review approved"),
        onError: (error) => toast.error(moderationErrorMessage(error)),
      },
    );
  };

  const handleReject = (id: string, reason?: string) => {
    rejectReview.mutate(
      { id, reason },
      {
        onSuccess: () => toast.success("Review rejected"),
        onError: (error) => toast.error(moderationErrorMessage(error)),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Status</span>
        <Select value={status} onValueChange={(v) => setStatus(v as ModerationStatus)}>
          <SelectTrigger className="w-44" aria-label="Moderation status filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODERATION_STATUS_FILTERS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isLoading ? (
        <p className="text-center text-muted-foreground py-12">Loading…</p>
      ) : reviews.length > 0 ? (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewModerationRow
              key={review.id}
              review={review}
              onApprove={(reason) => handleApprove(review.id, reason)}
              onReject={(reason) => handleReject(review.id, reason)}
              isApproving={approveReview.isPending && approveReview.variables?.id === review.id}
              isRejecting={rejectReview.isPending && rejectReview.variables?.id === review.id}
            />
          ))}

          {query.hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
              >
                {query.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Card className="border-2 border-dashed">
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
            <MessageSquareWarning className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{moderationEmptyStateMessage(status)}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
