import {
  RestaurantRatingAggregate,
  RestaurantRatingDistribution,
} from '../../../domain/engagement/repositories/IReviewRepository';

export interface RestaurantRatingResponse {
  restaurantId: string;
  avgRating: number;
  reviewCount: number;
  distribution: RestaurantRatingDistribution;
}

/**
 * The zero case no longer needs special handling: the aggregation always returns a row,
 * with zeros when a restaurant has no approved reviews. The response shape is unchanged
 * from when this read a `restaurant_rating_views` document.
 */
export function toRestaurantRatingResponse(
  rating: RestaurantRatingAggregate
): RestaurantRatingResponse {
  return {
    restaurantId: rating.restaurantId,
    avgRating: rating.avgRating,
    reviewCount: rating.reviewCount,
    distribution: rating.distribution,
  };
}
