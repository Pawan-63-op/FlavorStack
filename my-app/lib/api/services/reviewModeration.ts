import { reviewAdapter, type ReviewResponse, type ReviewView } from "../adapters/review";
import { client } from "../client/http";

/**
 * Review moderation service (Phase 11, Batch 11.1) — ADMIN-only moderation
 * queue over the composed API client. Mapping source:
 * `my-app/integration_phases/Phase_11.md` (frozen server_2 `/admin/reviews*`
 * contract). Reuses the Phase 9 `reviewAdapter`/`ReviewView` — the moderation
 * endpoints return the same `ReviewResponse` shape.
 *
 * The list endpoint returns a **bare `ReviewResponse[]`** (no wrapper, no
 * total) with **offset** pagination, so `hasMore` is derived from the page
 * length — same length-derived limitation already accepted in Phase 9.
 */

export interface ListAdminReviewsParams {
  status?: string;
  limit?: number;
  offset?: number;
}

export interface AdminReviewsPage {
  items: ReviewView[];
  hasMore: boolean;
}

const DEFAULT_LIMIT = 20;

/** Builds a `?status&limit=&offset=` query string, omitting `status` when unset. */
function buildListQuery(params: ListAdminReviewsParams, limit: number, offset: number): string {
  const search = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (params.status) search.set("status", params.status);
  return `?${search.toString()}`;
}

class ReviewModerationService {
  /** Composed transport (single-flight 401→refresh applied). */
  private readonly http = client;

  /** GET /admin/reviews?status&limit&offset → reviewAdapter per item; length-derived `hasMore`. Defaults to PENDING server-side when `status` is omitted. */
  async listAdminReviews(params: ListAdminReviewsParams = {}): Promise<AdminReviewsPage> {
    const { limit = DEFAULT_LIMIT, offset = 0 } = params;
    const dtos = await this.http.get<ReviewResponse[]>(
      `/admin/reviews${buildListQuery(params, limit, offset)}`,
    );
    const items = dtos.map(reviewAdapter);
    return { items, hasMore: items.length === limit };
  }

  /** POST /admin/reviews/:id/approve with an optional reason → reviewAdapter. */
  async approveReview(id: string, reason?: string): Promise<ReviewView> {
    const dto = await this.http.post<ReviewResponse>(`/admin/reviews/${id}/approve`, {
      body: reason ? { reason } : {},
    });
    return reviewAdapter(dto);
  }

  /** POST /admin/reviews/:id/reject with an optional reason → reviewAdapter. */
  async rejectReview(id: string, reason?: string): Promise<ReviewView> {
    const dto = await this.http.post<ReviewResponse>(`/admin/reviews/${id}/reject`, {
      body: reason ? { reason } : {},
    });
    return reviewAdapter(dto);
  }
}

export const reviewModerationService = new ReviewModerationService();
