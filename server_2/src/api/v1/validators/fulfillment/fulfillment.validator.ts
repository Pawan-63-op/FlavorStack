import { z } from 'zod';
import { FAILURE_REASON } from '../../../../domain/fulfillment/enums/failure-reason.enum';

export const fulfillmentIdParam = z.object({
  id: z.string().min(1, 'Fulfillment id is required'),
});

export const restaurantIdParam = z.object({
  restaurantId: z.string().min(1, 'Restaurant id is required'),
});

export const markPreparingSchema = z.object({
  prepEstimateMinutes: z.number().int().positive().optional(),
});

export const restaurantFulfillmentsQuery = z.object({
  status: z.string().optional(),
});

export const rejectDeliverySchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});

export const reassignSchema = z.object({
  riderId: z.string().min(1).optional(),
});

export const deliverSchema = z.object({
  proof: z.string().min(1).max(500).optional(),
});

export const cancelSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required').max(500),
});

export const failSchema = z.object({
  failureReason: z.enum(Object.values(FAILURE_REASON) as [string, ...string[]]),
});

export const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const adminDashboardQuery = z.object({
  status: z.string().optional(),
  slaBreached: z.enum(['true', 'false']).optional(),
  restaurantId: z.string().optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  offset: z.string().regex(/^\d+$/).optional(),
});
