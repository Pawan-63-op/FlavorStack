// Read shape returned by GetRestaurantRating (engagement_module.md §5/§7).
import {
  RestaurantRatingDistribution,
  RestaurantRatingView,
} from '../../../domain/engagement/repositories/IRestaurantRatingViewRepository';

export interface RestaurantRatingResponse {
  restaurantId: string;
  avgRating: number;
  reviewCount: number;
  distribution: RestaurantRatingDistribution;
}

const ZERO_DISTRIBUTION = (): RestaurantRatingDistribution => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });

export function toRestaurantRatingResponse(
  restaurantId: string,
  view: RestaurantRatingView | null
): RestaurantRatingResponse {
  if (!view) {
    return { restaurantId, avgRating: 0, reviewCount: 0, distribution: ZERO_DISTRIBUTION() };
  }
  return {
    restaurantId: view.restaurantId,
    avgRating: view.avgRating,
    reviewCount: view.reviewCount,
    distribution: view.distribution,
  };
}
