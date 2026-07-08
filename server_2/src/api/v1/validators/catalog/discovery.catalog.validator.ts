import { z } from 'zod';
import {
  uuid,
  cuisineEnum,
  dietaryEnum,
  csvOf,
  boolFromString,
  cursorLimit,
} from './shared.catalog.validator';

export const listRestaurantsQuery = z.object({
  cuisineTypes: csvOf(cuisineEnum),
  isOpen: boolFromString,
  ...cursorLimit,
});

export const searchRestaurantsQuery = z.object({
  q: z.string().min(1).max(120),
  cuisineTypes: csvOf(cuisineEnum),
  isOpenNow: boolFromString,
  ...cursorLimit,
});

export const searchMenuItemsQuery = z.object({
  q: z.string().min(1).max(120),
  dietary: csvOf(dietaryEnum),
  isAvailable: boolFromString,
  restaurantId: uuid.optional(),
  ...cursorLimit,
});

export const nearbyQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusMeters: z.coerce.number().positive().max(50000).optional(),
  cuisineTypes: csvOf(cuisineEnum),
  isOpenNow: boolFromString,
  ...cursorLimit,
});

export const serviceabilityQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  subtotalAmount: z.coerce.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional(),
});

export const itemsSnapshotQuery = z.object({
  ids: z
    .string()
    .transform((s) => s.split(',').map((v) => v.trim()).filter(Boolean))
    .pipe(z.array(uuid).min(1)),
});
