export interface RestaurantRatingDistribution {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

export interface RestaurantRatingView {
  restaurantId: string;
  avgRating: number;
  reviewCount: number;
  distribution: RestaurantRatingDistribution;
  updatedAt: Date;
}

export interface IRestaurantRatingViewRepository {
  findByRestaurantId(restaurantId: string): Promise<RestaurantRatingView | null>;
  upsert(view: RestaurantRatingView): Promise<void>;
}
