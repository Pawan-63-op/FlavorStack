// Input DTO: Checkout (Commerce Phase 11 Batch 4) — the committing checkout request for the customer's
// active cart (commerce_module.md §4.4). Unlike PreviewCheckout this carries an Idempotency-Key (from the
// Idempotency-Key header; minted when absent), the chosen payment method, and the full delivery address that
// is snapshotted onto the immutable OrderRequest. The delivery point used for serviceability/distance is the
// address coordinates, so preview (which takes a bare point) and checkout resolve the same pricing.
import { PaymentMethod } from '../../../domain/commerce/enums/payment-method.enum';

export interface CheckoutAddressDto {
  label?: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export interface CheckoutRequestDto {
  customerId: string;
  idempotencyKey?: string;
  paymentMethod: PaymentMethod;
  deliveryAddress: CheckoutAddressDto;
}
