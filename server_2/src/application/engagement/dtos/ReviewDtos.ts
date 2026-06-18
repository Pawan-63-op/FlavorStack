// Input DTOs for Review/Rating use cases (engagement_module.md §4).
import { ModerationStatusValue } from '../../../domain/engagement/enums/moderation-status.enum';

export interface SubmitReviewDto {
  customerId: string;
  restaurantId: string;
  fulfillmentId: string;
  restaurantRating: number;
  deliveryRating?: number | null;
  comment?: string | null;
}

export interface EditReviewCommentDto {
  customerId: string;
  reviewId: string;
  comment: string;
}

export interface ModerateReviewDto {
  moderatorId: string;
  reviewId: string;
  action: 'APPROVE' | 'REJECT';
  reason?: string;
}

export interface RecomputeRestaurantRatingDto {
  restaurantId: string;
}

export interface GetRestaurantReviewsDto {
  restaurantId: string;
  limit?: number;
  offset?: number;
}

export interface GetMyReviewsDto {
  customerId: string;
  limit?: number;
  offset?: number;
}

export interface GetRestaurantRatingDto {
  restaurantId: string;
}

export interface ListPendingReviewsDto {
  status?: ModerationStatusValue;
  limit?: number;
  offset?: number;
}
