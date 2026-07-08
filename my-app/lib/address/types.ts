/**
 * Local address-book view-model (Batch 6.1). The server has no address-book
 * API, so this is the richer FE shape; `toDeliveryAddress` strips it down to
 * what `/checkout` actually accepts.
 */
export interface Address {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  addressLines: string;
  city: string;
  state: string;
  pinCode: string;
  landmark?: string;
  lat: number;
  lng: number;
  deliveryInstructions?: string;
  isDefault: boolean;
}
