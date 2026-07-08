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
