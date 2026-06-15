// Zod validators for the customer-facing Checkout API (§9). The Idempotency-Key is NOT validated here — it
// arrives as a required UUID header enforced by the requireIdempotencyKey middleware. This schema covers the
// request body: paymentMethod must be in the PAYMENT_METHOD enum and deliveryAddress must be well-formed.
// Domain-level address rules (e.g. precise pin-code format) are enforced by the Address VO in the use case.
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

// PreviewCheckout (§9 query, Phase 13) is a dry-run: it needs only the delivery point (bare
// lat/lng) to resolve serviceability + delivery fee + the full pricing breakdown. No payment
// method or full address — those belong to the committing Checkout.
export const previewCheckoutSchema = z.object({
  deliveryPoint: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
});
