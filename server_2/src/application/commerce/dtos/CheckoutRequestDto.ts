import { PaymentMethod } from '../../../domain/commerce/enums/payment-method.enum';

/**
 * @deprecated Client-supplied delivery address. Accepted for one release so existing
 * clients keep working; the delivery fee is computed from `coordinates`, so a client can
 * understate the distance. Prefer `addressId`, which resolves the address server-side from
 * the customer's saved address book. Remove this shape once no caller sends it.
 */
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
  /** Id of one of the customer's saved addresses (`GET /users/me/addresses`). */
  addressId?: string;
  /** @deprecated Legacy inline address; ignored when `addressId` is present. */
  deliveryAddress?: CheckoutAddressDto;
}
