/**
 * Address-book view-model. Server-backed since G12 (`/users/me/addresses`), with
 * the store as a cache. `id` is the server's address id — checkout sends it as
 * `addressId` and the server resolves the address, so the client never supplies
 * the coordinates the delivery fee is computed from.
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
