/**
 * server_2 aggregate rating DTO → app rating view-model.
 *
 * Mapping source: `my-app/integration_phases/Phase_9.md` (frozen server_2
 * `GET /restaurants/:id/rating` contract, engagement context
 * `RestaurantRatingResponse`). Zeroed (`avgRating: 0, reviewCount: 0`) when a
 * restaurant has no reviews yet.
 */

export interface RestaurantRatingResponse {
  restaurantId: string;
  avgRating: number;
  reviewCount: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface RatingDistributionBar {
  star: 1 | 2 | 3 | 4 | 5;
  count: number;
  /** Share of `reviewCount` this star rating accounts for, rounded to a whole percent. */
  percentage: number;
}

export interface RestaurantRatingView {
  restaurantId: string;
  avgRating: number;
  reviewCount: number;
  /** Bar-chart-ready, ordered 5★ → 1★. */
  distribution: RatingDistributionBar[];
}

const STARS = [5, 4, 3, 2, 1] as const;

/** Pure DTO→view-model map. */
export function restaurantRatingAdapter(dto: RestaurantRatingResponse): RestaurantRatingView {
  const distribution = STARS.map((star) => {
    const count = dto.distribution[star] ?? 0;
    const percentage = dto.reviewCount === 0 ? 0 : Math.round((count / dto.reviewCount) * 100);
    return { star, count, percentage };
  });

  return {
    restaurantId: dto.restaurantId,
    avgRating: dto.avgRating,
    reviewCount: dto.reviewCount,
    distribution,
  };
}
