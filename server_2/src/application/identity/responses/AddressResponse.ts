export interface AddressResponse {
  id: string;
  label?: string;
  recipientName?: string;
  phone?: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
  landmark?: string;
  deliveryInstructions?: string;
  coordinates: { lat: number; lng: number };
  isDefault: boolean;
}
