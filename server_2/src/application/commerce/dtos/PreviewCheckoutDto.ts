export interface PreviewCheckoutDto {
  customerId: string;
  /** Id of one of the customer's saved addresses (`GET /users/me/addresses`). */
  addressId?: string;
  /** @deprecated Legacy client-supplied point; ignored when `addressId` is present. */
  deliveryPoint?: {
    lat: number;
    lng: number;
  };
}
