import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewResponse } from "../adapters/review";
import { client } from "../client/http";
import { reviewModerationService } from "./reviewModeration";

vi.mock("../client/http", () => ({
  client: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
    raw: vi.fn(),
  },
}));

function makeDto(overrides: Partial<ReviewResponse> = {}): ReviewResponse {
  return {
    reviewId: "rev1",
    customerId: "cust1",
    restaurantId: "rest1",
    fulfillmentId: "ful1",
    restaurantRating: 5,
    deliveryRating: 4,
    comment: "Great food",
    moderationStatus: "PENDING",
    createdAt: "2026-06-22T10:00:00.000Z",
    ...overrides,
  };
}

describe("reviewModerationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listAdminReviews", () => {
    it("GETs /admin/reviews with default limit/offset and no status, and adapts each item", async () => {
      vi.mocked(client.get).mockResolvedValue([makeDto()]);

      const page = await reviewModerationService.listAdminReviews();

      expect(client.get).toHaveBeenCalledWith("/admin/reviews?limit=20&offset=0");
      expect(page.items).toHaveLength(1);
      expect(page.items[0].id).toBe("rev1");
    });

    it("includes status when provided", async () => {
      vi.mocked(client.get).mockResolvedValue([]);

      await reviewModerationService.listAdminReviews({ status: "AUTO_FLAGGED" });

      expect(client.get).toHaveBeenCalledWith(
        "/admin/reviews?limit=20&offset=0&status=AUTO_FLAGGED",
      );
    });

    it("passes through explicit limit/offset", async () => {
      vi.mocked(client.get).mockResolvedValue([]);

      await reviewModerationService.listAdminReviews({ limit: 5, offset: 10 });

      expect(client.get).toHaveBeenCalledWith("/admin/reviews?limit=5&offset=10");
    });

    it("reports hasMore=true at a full-page boundary", async () => {
      vi.mocked(client.get).mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => makeDto({ reviewId: `r${i}` })),
      );

      const page = await reviewModerationService.listAdminReviews({ limit: 5 });

      expect(page.hasMore).toBe(true);
    });

    it("reports hasMore=false when a page returns fewer than limit", async () => {
      vi.mocked(client.get).mockResolvedValue([makeDto()]);

      const page = await reviewModerationService.listAdminReviews({ limit: 5 });

      expect(page.hasMore).toBe(false);
    });
  });

  describe("approveReview", () => {
    it("POSTs to /admin/reviews/:id/approve and omits reason when blank", async () => {
      vi.mocked(client.post).mockResolvedValue(makeDto({ moderationStatus: "APPROVED" }));

      const vm = await reviewModerationService.approveReview("rev1");

      expect(client.post).toHaveBeenCalledWith("/admin/reviews/rev1/approve", { body: {} });
      expect(vm.moderationStatus).toBe("APPROVED");
    });

    it("includes the reason when provided", async () => {
      vi.mocked(client.post).mockResolvedValue(makeDto({ moderationStatus: "APPROVED" }));

      await reviewModerationService.approveReview("rev1", "Looks fine");

      expect(client.post).toHaveBeenCalledWith("/admin/reviews/rev1/approve", {
        body: { reason: "Looks fine" },
      });
    });
  });

  describe("rejectReview", () => {
    it("POSTs to /admin/reviews/:id/reject and omits reason when blank", async () => {
      vi.mocked(client.post).mockResolvedValue(makeDto({ moderationStatus: "REJECTED" }));

      const vm = await reviewModerationService.rejectReview("rev1");

      expect(client.post).toHaveBeenCalledWith("/admin/reviews/rev1/reject", { body: {} });
      expect(vm.moderationStatus).toBe("REJECTED");
    });

    it("includes the reason when provided", async () => {
      vi.mocked(client.post).mockResolvedValue(makeDto({ moderationStatus: "REJECTED" }));

      await reviewModerationService.rejectReview("rev1", "Spam");

      expect(client.post).toHaveBeenCalledWith("/admin/reviews/rev1/reject", {
        body: { reason: "Spam" },
      });
    });
  });
});
