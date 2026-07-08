import { z } from 'zod';
import { uuid, moneyInput, dietaryEnum, selectionTypeEnum } from './shared.catalog.validator';

export const itemIdParam = z.object({ id: uuid });

export const addMenuItemSchema = z.object({
  categoryId: uuid,
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().url().optional(),
  basePrice: moneyInput,
  tags: z.array(z.string().min(1).max(40)).optional(),
  dietary: z.array(dietaryEnum).optional(),
});

export const updateMenuItemSchema = z
  .object({
    categoryId: uuid.optional(),
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(2000).optional(),
    imageUrl: z.string().url().optional(),
    price: moneyInput.optional(),
    tags: z.array(z.string().min(1).max(40)).optional(),
    dietary: z.array(dietaryEnum).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'No updatable fields provided' });

export const toggleAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
  availableFrom: z.coerce.date().optional(),
  availableUntil: z.coerce.date().optional(),
  outOfStockReason: z.string().max(200).optional(),
});

const optionInput = z.object({
  label: z.string().min(1).max(80),
  priceDelta: moneyInput,
  isDefault: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
});

const variantGroupInput = z.object({
  label: z.string().min(1).max(80),
  selectionType: selectionTypeEnum,
  required: z.boolean().optional(),
  minSelect: z.number().int().nonnegative(),
  maxSelect: z.number().int().positive(),
  options: z.array(optionInput).optional(),
});

export const setItemVariantsSchema = z.object({
  groups: z.array(variantGroupInput),
});
