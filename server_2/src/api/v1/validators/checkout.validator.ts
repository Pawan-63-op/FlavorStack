import { z } from 'zod';
import { PAYMENT_METHOD, PaymentMethod } from '../../../domain/commerce/enums/payment-method.enum';

const PAYMENT_METHODS = Object.values(PAYMENT_METHOD) as [PaymentMethod, ...PaymentMethod[]];

export const checkoutAddressSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  street: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().min(1).max(120),
  pinCode: z.string().trim().min(1).max(20),
  coordinates: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
});

export const checkoutSchema = z.object({
  paymentMethod: z.enum(PAYMENT_METHODS),
  deliveryAddress: checkoutAddressSchema,
});

export const previewCheckoutSchema = z.object({
  deliveryPoint: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
});
