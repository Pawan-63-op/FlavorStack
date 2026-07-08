import { reviewAdapter, type ReviewResponse, type ReviewView } from "../adapters/review";
import {
  restaurantRatingAdapter,
  type RestaurantRatingResponse,
  type RestaurantRatingView,
} from "../adapters/reviewRating";
import { client } from "../client/http";

/**
 * Review service — dual-rating, verified-purchase reviews over the composed
 * API client (Batch 9.1). Mapping source: `my-app/integration_phases/Phase_9.md`
 * (frozen server_2 `/restaurants/:id/reviews`, `/me/reviews`,
 * `/restaurants/:id/rating` contract, engagement context).
 *
 * The list endpoints return a **bare `ReviewResponse[]`** (no wrapper, no
 * total) with **offset** pagination, so `hasMore` is derived from the page
 * length — a full page (`length === limit`) is assumed to have more. This can
 * produce one empty final "load more" (documented limitation).
 */

export interface ListReviewsParams {
  limit?: number;
  offset?: number;
}

export interface ReviewsPage {
  items: ReviewView[];
  hasMore: boolean;
}

export interface CreateReviewInput {
  restaurantId: string;
  fulfillmentId: string;
  restaurantRating: number;
  deliveryRating?: number | null;
  comment?: string | null;
}

const DEFAULT_LIMIT = 20;

/** Builds a `?limit=&offset=` query string for the bare-array list endpoints. */
function buildListQuery(limit: number, offset: number): string {
  const search = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return `?${search.toString()}`;
}

class ReviewService {
  /** Composed transport (single-flight 401→refresh applied). */
  private readonly http = client;

  /** GET /restaurants/:id/reviews?limit&offset → reviewAdapter per item (APPROVED-only, public); length-derived `hasMore`. */
  async listRestaurantReviews(
    restaurantId: string,
    params: ListReviewsParams = {},
  ): Promise<ReviewsPage> {
    const { limit = DEFAULT_LIMIT, offset = 0 } = params;
    const dtos = await this.http.get<ReviewResponse[]>(
      `/restaurants/${restaurantId}/reviews${buildListQuery(limit, offset)}`,
    );
    const items = dtos.map(reviewAdapter);
    return { items, hasMore: items.length === limit };
  }

  /** GET /me/reviews?limit&offset → reviewAdapter per item (all statuses, auth required); length-derived `hasMore`. */
  async listMyReviews(params: ListReviewsParams = {}): Promise<ReviewsPage> {
    const { limit = DEFAULT_LIMIT, offset = 0 } = params;
    const dtos = await this.http.get<ReviewResponse[]>(
      `/me/reviews${buildListQuery(limit, offset)}`,
    );
    const items = dtos.map(reviewAdapter);
    return { items, hasMore: items.length === limit };
  }

  /** GET /restaurants/:id/rating → restaurantRatingAdapter. */
  async getRestaurantRating(restaurantId: string): Promise<RestaurantRatingView> {
    const dto = await this.http.get<RestaurantRatingResponse>(
      `/restaurants/${restaurantId}/rating`,
    );
    return restaurantRatingAdapter(dto);
  }

  /** POST /restaurants/:id/reviews with the dual-rating body → reviewAdapter. */
  async createReview(input: CreateReviewInput): Promise<ReviewView> {
    const { restaurantId, ...body } = input;
    const dto = await this.http.post<ReviewResponse>(`/restaurants/${restaurantId}/reviews`, {
      body,
    });
    return reviewAdapter(dto);
  }
}

export const reviewService = new ReviewService();
