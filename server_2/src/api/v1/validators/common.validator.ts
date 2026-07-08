import { z } from 'zod';

export const objectId = z.string().uuid('Invalid id format');

export const userIdParam = z.object({
  userId: objectId,
});

export const adminIdParam = z.object({
  adminId: objectId,
});

export const driverIdParam = z.object({
  id: objectId,
});

export const sessionIdParam = z.object({
  sessionId: z.string().uuid('Invalid session id format'),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
