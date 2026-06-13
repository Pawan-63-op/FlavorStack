export interface ActorContext {
  actorId: string;
  isSuperAdmin?: boolean;
}

export interface GeoPointInput {
  lat: number;
  lng: number;
}

export interface AddressInput {
  label?: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
  coordinates: GeoPointInput;
}

export interface MoneyInput {
  amount: number;
  currency?: string;
}
