import { z } from 'zod';
import { MODERATION_STATUS } from '../../../domain/engagement/enums/moderation-status.enum';

export const submitReviewSchema = z.object({
  fulfillmentId: z.string().min(1, 'Fulfillment id is required'),
  restaurantRating: z.number().int().min(1).max(5),
  deliveryRating: z.number().int().min(1).max(5).optional().nullable(),
  comment: z.string().max(1000).optional().nullable(),
});

export const restaurantIdParam = z.object({
  restaurantId: z.string().min(1, 'Restaurant id is required'),
});

export const reviewIdParam = z.object({
  id: z.string().min(1, 'Review id is required'),
});

export const reviewsListQuery = z.object({
  limit: z.string().regex(/^\d+$/).optional(),
  offset: z.string().regex(/^\d+$/).optional(),
});

export const myReviewsQuery = z.object({
  limit: z.string().regex(/^\d+$/).optional(),
  offset: z.string().regex(/^\d+$/).optional(),
});

export const moderateReviewSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const pendingReviewsQuery = z.object({
  status: z.enum(Object.values(MODERATION_STATUS) as [string, ...string[]]).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  offset: z.string().regex(/^\d+$/).optional(),
});
