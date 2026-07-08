import type { Address } from "@/lib/address/types";

/**
 * server_2 self-service address DTO (Phase 15 / G12) ↔ FE address view-model.
 *
 * The server (`application/identity/responses/AddressResponse.ts`) stores the
 * richer address losslessly: it keeps the FE-only contact/extra fields
 * (recipientName, phone, landmark, deliveryInstructions) alongside the
 * checkout-required core. The only shape differences are `street`↔`addressLines`
 * and nested `coordinates`↔flat `lat`/`lng`.
 */
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

/** Request body for POST/PATCH `/users/me/addresses` (flat coordinates). */
export interface AddressRequestBody {
  label?: string;
  recipientName?: string;
  phone?: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
  landmark?: string;
  deliveryInstructions?: string;
  lat: number;
  lng: number;
  isDefault?: boolean;
}

/** Server address DTO → FE address view-model. */
export function addressResponseAdapter(dto: AddressResponse): Address {
  return {
    id: dto.id,
    label: dto.label ?? "Home",
    recipientName: dto.recipientName ?? "",
    phone: dto.phone ?? "",
    addressLines: dto.street,
    city: dto.city,
    state: dto.state,
    pinCode: dto.pinCode,
    landmark: dto.landmark,
    deliveryInstructions: dto.deliveryInstructions,
    lat: dto.coordinates.lat,
    lng: dto.coordinates.lng,
    isDefault: dto.isDefault,
  };
}

/** FE address form payload → server request body. */
export function toAddressBody(input: Omit<Address, "id">): AddressRequestBody {
  return {
    label: input.label,
    recipientName: input.recipientName,
    phone: input.phone,
    street: input.addressLines,
    city: input.city,
    state: input.state,
    pinCode: input.pinCode,
    landmark: input.landmark,
    deliveryInstructions: input.deliveryInstructions,
    lat: input.lat,
    lng: input.lng,
    isDefault: input.isDefault,
  };
}
