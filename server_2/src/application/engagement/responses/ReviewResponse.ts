import { Review } from '../../../domain/engagement/entities/Review';

export interface ReviewResponse {
  reviewId: string;
  customerId: string;
  restaurantId: string;
  fulfillmentId: string;
  restaurantRating: number;
  deliveryRating: number | null;
  comment: string | null;
  moderationStatus: string;
  createdAt: string;
  moderatedAt?: string;
  moderatedBy?: string;
}

export function toReviewResponse(review: Review): ReviewResponse {
  return {
    reviewId: review.id.toString(),
    customerId: review.customerId,
    restaurantId: review.restaurantId,
    fulfillmentId: review.fulfillmentId,
    restaurantRating: review.restaurantRating.value,
    deliveryRating: review.deliveryRating?.value ?? null,
    comment: review.comment?.value ?? null,
    moderationStatus: review.moderationStatus.value,
    createdAt: review.createdAt.toISOString(),
    moderatedAt: review.moderatedAt?.toISOString(),
    moderatedBy: review.moderatedBy,
  };
}
