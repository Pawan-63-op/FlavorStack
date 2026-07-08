import { describe, expect, it } from "vitest";
import { reviewAdapter, type ReviewResponse } from "./review";

function makeReview(overrides: Partial<ReviewResponse> = {}): ReviewResponse {
  return {
    reviewId: "rev1",
    customerId: "cust1",
    restaurantId: "rest1",
    fulfillmentId: "ful1",
    restaurantRating: 5,
    deliveryRating: 4,
    comment: "Great food",
    moderationStatus: "APPROVED",
    createdAt: "2026-06-22T10:00:00.000Z",
    ...overrides,
  };
}

describe("reviewAdapter", () => {
  it("maps reviewId→id and carries the core fields", () => {
    const vm = reviewAdapter(makeReview());
    expect(vm.id).toBe("rev1");
    expect(vm.restaurantId).toBe("rest1");
    expect(vm.fulfillmentId).toBe("ful1");
    expect(vm.restaurantRating).toBe(5);
    expect(vm.deliveryRating).toBe(4);
    expect(vm.comment).toBe("Great food");
  });

  it("carries a null deliveryRating/comment through unchanged", () => {
    const vm = reviewAdapter(makeReview({ deliveryRating: null, comment: null }));
    expect(vm.deliveryRating).toBeNull();
    expect(vm.comment).toBeNull();
  });

  it("derives isPublished from moderationStatus === 'APPROVED'", () => {
    expect(reviewAdapter(makeReview({ moderationStatus: "APPROVED" })).isPublished).toBe(true);
    expect(reviewAdapter(makeReview({ moderationStatus: "PENDING" })).isPublished).toBe(false);
    expect(reviewAdapter(makeReview({ moderationStatus: "AUTO_FLAGGED" })).isPublished).toBe(false);
    expect(reviewAdapter(makeReview({ moderationStatus: "REJECTED" })).isPublished).toBe(false);
  });

  it("derives a human label for each moderation status", () => {
    expect(reviewAdapter(makeReview({ moderationStatus: "PENDING" })).moderationStatusLabel).toBe(
      "Pending review",
    );
    expect(
      reviewAdapter(makeReview({ moderationStatus: "AUTO_FLAGGED" })).moderationStatusLabel,
    ).toBe("Pending review");
    expect(reviewAdapter(makeReview({ moderationStatus: "APPROVED" })).moderationStatusLabel).toBe(
      "Published",
    );
    expect(reviewAdapter(makeReview({ moderationStatus: "REJECTED" })).moderationStatusLabel).toBe(
      "Rejected",
    );
  });

  it("formats createdAt and carries a generic author label", () => {
    const vm = reviewAdapter(makeReview({ createdAt: "2026-06-22T10:00:00.000Z" }));
    expect(vm.formattedDate).toBe("Jun 22, 2026");
    expect(vm.authorLabel).toBe("Verified customer");
  });

  it("is array-safe via Array.prototype.map", () => {
    const vms = [makeReview(), makeReview({ reviewId: "rev2" })].map(reviewAdapter);
    expect(vms).toHaveLength(2);
    expect(vms[1].id).toBe("rev2");
  });
});
