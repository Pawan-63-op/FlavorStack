// Zod validators for the restaurant owner-write surface (profile, status,
// visibility, opening hours, categories, delivery zones). `actorId` is never in
// the body — it comes from the verified token in the controller.
import { z } from 'zod';
import {
  uuid,
  latLng,
  moneyInput,
  addressInput,
  cuisineEnum,
  visibilityEnum,
  weeklySchedule,
} from './shared.catalog.validator';
import { DELIVERY_ZONE_ACTION } from '../../../../application/catalog/dtos/ManageDeliveryZoneDto';

export const restaurantIdParam = z.object({ id: uuid });
export const categoryIdParam = z.object({ id: uuid, categoryId: uuid });

export const createRestaurantSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(140).optional(),
  description: z.string().max(2000).optional(),
  cuisineTypes: z.array(cuisineEnum).min(1),
  address: addressInput,
  location: latLng,
  phone: z.string().min(5).max(20),
  imageUrl: z.string().url().optional(),
});

export const updateRestaurantSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(2000).optional(),
    cuisineTypes: z.array(cuisineEnum).min(1).optional(),
    address: addressInput.optional(),
    location: latLng.optional(),
    phone: z.string().min(5).max(20).optional(),
    imageUrl: z.string().url().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'No updatable fields provided' });

export const setVisibilitySchema = z.object({ visibility: visibilityEnum });

export const setOpeningHoursSchema = z.object({
  schedule: weeklySchedule,
  holidays: z.array(z.string()).optional(),
});

export const addCategorySchema = z.object({
  label: z.string().min(1).max(80),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const updateCategorySchema = z
  .object({
    label: z.string().min(1).max(80).optional(),
    sortOrder: z.number().int().nonnegative().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'No updatable fields provided' });

export const reorderCategoriesSchema = z.object({
  orderedCategoryIds: z.array(uuid).min(1),
});

const feeMatrixInput = z.object({
  tiers: z
    .array(z.object({ maxDistanceMeters: z.number().positive(), fee: moneyInput }))
    .min(1),
  freeAboveSubtotal: moneyInput.optional(),
});

export const manageZoneSchema = z.object({
  action: z.enum([
    DELIVERY_ZONE_ACTION.ADD,
    DELIVERY_ZONE_ACTION.UPDATE,
    DELIVERY_ZONE_ACTION.REMOVE,
  ]),
  zoneId: uuid.optional(),
  polygon: z.array(latLng).min(3).optional(),
  feeMatrix: feeMatrixInput.optional(),
  minOrder: moneyInput.optional(),
});
