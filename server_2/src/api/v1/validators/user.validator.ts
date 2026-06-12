// Zod schemas for self-service user/profile DTOs
import { z } from 'zod';

export const updateMeSchema = z
  .object({
    name: z.string().min(1).optional(),
    avatarUrl: z.string().url().optional(),
  })
  .strict();
