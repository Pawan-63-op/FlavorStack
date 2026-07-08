import { z } from 'zod';

export const updateMeSchema = z
  .object({
    name: z.string().min(1).optional(),
    avatarUrl: z.string().url().optional(),
  })
  .strict();

export const setAvailabilitySchema = z.object({ available: z.boolean() }).strict();

export const addressBodySchema = z
  .object({
    label: z.string().min(1).max(40).optional(),
    recipientName: z.string().min(1).max(120).optional(),
    phone: z.string().min(1).max(20).optional(),
    street: z.string().min(1).max(240),
    city: z.string().min(1).max(120),
    state: z.string().min(1).max(120),
    pinCode: z.string().regex(/^\d{6}$/, 'pinCode must be a 6-digit Indian PIN code'),
    landmark: z.string().max(240).optional(),
    deliveryInstructions: z.string().max(500).optional(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    isDefault: z.boolean().optional(),
  })
  .strict();
