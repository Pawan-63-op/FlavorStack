import { z } from 'zod';
import { Quantity } from '../../../../domain/commerce/value-objects/Quantity';

export const uuid = z.string().uuid('Invalid id format');

export const moneyInput = z.object({
  amount: z.number().int().nonnegative(),
  currency: z.string().length(3).optional(),
});

export const cartItemIdParam = z.object({ itemId: uuid });

export const addToCartSchema = z.object({
  restaurantId: uuid,
  menuItemId: uuid,
  selectedOptionIds: z.array(uuid).optional(),
  quantity: z.number().int().min(Quantity.MIN).max(Quantity.MAX),
  unitPrice: moneyInput,
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(0).max(Quantity.MAX),
});

export const promotionCodeSchema = z.object({
  code: z.string().trim().min(1, 'Promotion code is required').max(64),
});
