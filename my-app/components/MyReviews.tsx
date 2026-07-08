"use client";

import { motion } from "motion/react";
import { MessageSquare } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { useMyReviews } from "@/lib/api/hooks/useReviews";
import { ReviewCard } from "@/components/reviews/ReviewCard";

/**
 * "My reviews" page (Phase 9, Batch 9.3) — the customer's own reviews across all
 * moderation statuses (server returns all, not just APPROVED), via the
 * offset-paginated `useMyReviews` hook. Each card shows its moderation status
 * badge so a still-pending review is clearly explained. Replaces the legacy
 * Zustand `reviewStore`.
 */
export function MyReviews() {
  const query = useMyReviews();
  const reviews = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-semibold mb-1">My Reviews</h2>
        <p className="text-muted-foreground">
          {reviews.length} review{reviews.length !== 1 ? "s" : ""} given
        </p>
      </motion.div>

      {query.isLoading ? (
        <p className="text-center text-muted-foreground py-12">Loading…</p>
      ) : reviews.length > 0 ? (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} showStatus />
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
        <Card className="border-2 rounded-xl bg-card/50 backdrop-blur">
          <CardContent className="pt-12 pb-12 text-center">
            <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No reviews yet</h3>
            <p className="text-muted-foreground">
              You haven&apos;t reviewed any orders yet — place an order and share your experience!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
