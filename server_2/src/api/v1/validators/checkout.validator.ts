import { z } from 'zod';
import { PAYMENT_METHOD, PaymentMethod } from '../../../domain/commerce/enums/payment-method.enum';

const PAYMENT_METHODS = Object.values(PAYMENT_METHOD) as [PaymentMethod, ...PaymentMethod[]];

const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/**
 * @deprecated Client-supplied delivery address. The delivery fee is computed from these
 * coordinates, so a client can understate the distance; `addressId` resolves the address
 * server-side instead. Accepted for one release, then removed.
 */
export const checkoutAddressSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  street: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().min(1).max(120),
  pinCode: z.string().trim().min(1).max(20),
  coordinates: coordinatesSchema,
});

export const checkoutSchema = z
  .object({
    paymentMethod: z.enum(PAYMENT_METHODS),
    addressId: z.string().trim().min(1).max(200).optional(),
    deliveryAddress: checkoutAddressSchema.optional(),
  })
  .refine((body) => body.addressId !== undefined || body.deliveryAddress !== undefined, {
    message: 'Either addressId or deliveryAddress is required',
    path: ['addressId'],
  });

export const previewCheckoutSchema = z
  .object({
    addressId: z.string().trim().min(1).max(200).optional(),
    deliveryPoint: coordinatesSchema.optional(),
  })
  .refine((body) => body.addressId !== undefined || body.deliveryPoint !== undefined, {
    message: 'Either addressId or deliveryPoint is required',
    path: ['addressId'],
  });
