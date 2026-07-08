import { describe, expect, it } from "vitest";
import {
  COMMENT_MAX_LENGTH,
  reviewErrorMessage,
  validateReviewForm,
  type ReviewFormValues,
} from "./ReviewForm";
import { ApiError } from "@/lib/api/errors/ApiError";

function values(overrides: Partial<ReviewFormValues> = {}): ReviewFormValues {
  return { restaurantRating: 5, deliveryRating: null, comment: "", ...overrides };
}

describe("validateReviewForm — restaurant rating (required)", () => {
  it("is invalid when unset (0)", () => {
    const result = validateReviewForm(values({ restaurantRating: 0 }));
    expect(result.valid).toBe(false);
    expect(result.restaurantRatingError).not.toBeNull();
  });

  it("is valid for each star in 1–5", () => {
    for (const star of [1, 2, 3, 4, 5]) {
      const result = validateReviewForm(values({ restaurantRating: star }));
      expect(result.valid).toBe(true);
      expect(result.restaurantRatingError).toBeNull();
    }
  });

  it("is invalid above 5", () => {
    expect(validateReviewForm(values({ restaurantRating: 6 })).valid).toBe(false);
  });

  it("is invalid for a non-integer rating", () => {
    expect(validateReviewForm(values({ restaurantRating: 3.5 })).valid).toBe(false);
  });
});

describe("validateReviewForm — delivery rating (optional)", () => {
  it("is valid when null (omitted)", () => {
    const result = validateReviewForm(values({ deliveryRating: null }));
    expect(result.valid).toBe(true);
    expect(result.deliveryRatingError).toBeNull();
  });

  it("is valid for a 1–5 delivery rating", () => {
    expect(validateReviewForm(values({ deliveryRating: 4 })).valid).toBe(true);
  });

  it("is invalid for an out-of-range delivery rating", () => {
    const result = validateReviewForm(values({ deliveryRating: 6 }));
    expect(result.valid).toBe(false);
    expect(result.deliveryRatingError).not.toBeNull();
  });
});

describe("validateReviewForm — comment (bounded)", () => {
  it("allows a comment exactly at the limit", () => {
    const result = validateReviewForm(values({ comment: "x".repeat(COMMENT_MAX_LENGTH) }));
    expect(result.valid).toBe(true);
    expect(result.commentError).toBeNull();
  });

  it("rejects a comment over the limit", () => {
    const result = validateReviewForm(values({ comment: "x".repeat(COMMENT_MAX_LENGTH + 1) }));
    expect(result.valid).toBe(false);
    expect(result.commentError).not.toBeNull();
  });

  it("allows an empty comment", () => {
    expect(validateReviewForm(values({ comment: "" })).valid).toBe(true);
  });
});

describe("reviewErrorMessage", () => {
  // server_2 carries the domain reason in the message (umbrella code in `code`),
  // e.g. ValidationError('review_not_eligible') → { code: VALIDATION_ERROR,
  // message: 'review_not_eligible' } at 422. Mirror that shape here.
  function apiError(code: string, message: string, status: number): ApiError {
    return new ApiError({ code, message, status });
  }

  it("maps review_already_submitted (CONFLICT 409) to the already-reviewed message", () => {
    expect(reviewErrorMessage(apiError("CONFLICT", "review_already_submitted", 409))).toBe(
      "You've already reviewed this order.",
    );
  });

  it("maps review_not_eligible (VALIDATION_ERROR 422) to the delivery-gating message", () => {
    expect(reviewErrorMessage(apiError("VALIDATION_ERROR", "review_not_eligible", 422))).toBe(
      "Reviews open after your order has been delivered.",
    );
  });

  it("maps ownership/mismatch reasons to the generic guard message", () => {
    const guard = "We couldn't verify this order belongs to you.";
    expect(reviewErrorMessage(apiError("FORBIDDEN", "review_not_owned", 403))).toBe(guard);
    expect(reviewErrorMessage(apiError("VALIDATION_ERROR", "review_restaurant_mismatch", 422))).toBe(
      guard,
    );
  });

  it("falls back to a generic message for an unrecognised reason", () => {
    expect(reviewErrorMessage(apiError("VALIDATION_ERROR", "Validation failed", 422))).toContain(
      "Something went wrong",
    );
  });

  it("falls back to a generic message for a non-ApiError value", () => {
    expect(reviewErrorMessage(new Error("boom"))).toContain("Something went wrong");
    expect(reviewErrorMessage(undefined)).toContain("Something went wrong");
  });
});
