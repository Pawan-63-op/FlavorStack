import type { Address } from "./types";

export interface DeliveryAddress {
  label?: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
  coordinates: { lat: number; lng: number };
}

/** FE address (richer model) → server `/checkout` deliveryAddress shape. */
export function toDeliveryAddress(address: Address): DeliveryAddress {
  return {
    ...(address.label ? { label: address.label } : {}),
    street: address.addressLines,
    city: address.city,
    state: address.state,
    pinCode: address.pinCode,
    coordinates: { lat: address.lat, lng: address.lng },
  };
}
