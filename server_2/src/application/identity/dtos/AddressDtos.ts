
export interface AddressInputDto {
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

export interface ListAddressesDto {
  userId: string;
}

export interface AddAddressDto extends AddressInputDto {
  userId: string;
}

export interface UpdateAddressDto extends AddressInputDto {
  userId: string;
  addressId: string;
}

export interface DeleteAddressDto {
  userId: string;
  addressId: string;
}

export interface SetDefaultAddressDto {
  userId: string;
  addressId: string;
}
